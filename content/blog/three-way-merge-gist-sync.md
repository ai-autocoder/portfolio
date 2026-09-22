---
title: "Syncing Todos Through a GitHub Gist: A Three-Way Merge, 149 Tests"
date: "2026-09-22"
excerpt: "Two devices, one gist file, and an API with no conditional writes. How a content-based three-way merge keeps them in sync, and the bugs the tests caught."
tags: [sync, algorithms, typescript, testing, github-api, backend]
readTime: 9
---

# Syncing Todos Through a GitHub Gist: A Three-Way Merge, 149 Tests

VS Code Todo has had GitHub Gist sync since version 2.0.0: your todos and notes live in a secret gist in your own GitHub account, and every device you use reads and writes it. There's no server of mine in the middle, and no database. Just a JSON file per list.

That sounds simple until two devices edit the same list. And with a phone companion app on the way, that stops being an edge case and becomes the normal case: you tick something off on your phone while your laptop, unsynced, still has edits of its own.

This post is about the merge that makes that safe, the write path around it, and the bugs I found by testing it properly.

## The Constraint: No Compare-and-Swap

A database gives you tools for concurrent writes: transactions, row versions, `UPDATE ... WHERE version = 3`. The GitHub Gist API gives you none of that. You read a file, and you write a file. There's no "only write if nobody else has since".

So a naive sync (read, merge, write) has a nasty failure mode. If another device pushes between your read and your write, you overwrite its change. Worse, you then record what you wrote as the new clean state, so the lost change never comes back.

## Why Three-Way, and Why Content

A two-way comparison (mine versus theirs) can tell you the two sides differ. It can't tell you who changed what. For that you need a third version: the last state both sides agreed on.

Each device keeps that baseline per gist file, called `lastCleanRemoteData`: the content it knows was on the gist after its last successful sync. Every todo is then compared, by id, across three versions: baseline, local and remote.

The first version of the sync didn't work like this. It detected changes with timestamps, and it raised false conflicts. Device clocks differ, and the data model has no per-item `updatedAt` anyway. The fix replaced timestamps with content comparison against that tracked clean remote. Content doesn't lie about what changed.

Here are the rules, per todo:

| In base | Local | Remote | Result |
| --- | --- | --- | --- |
| yes | changed | unchanged | take local |
| yes | unchanged | changed | take remote |
| yes | changed | changed identically | take it |
| yes | changed | changed differently | **edit-edit conflict** |
| yes | changed | deleted | **edit-delete conflict** |
| yes | deleted | changed | **delete-edit conflict** |
| no | added | added, different content | **id-collision** |

The full table has 13 rows. Only those four bold outcomes need a human, or a policy. Everything else merges on its own, which is the whole point: most concurrent edits touch different todos and should never bother anyone.

The core check is short:

```ts
// In base, in local, in remote: the only place a real edit-edit conflict can come from.
if (inBase && inLocal && inRemote) {
  const localModified = !isEqual(baseTodo, localTodo);
  const remoteModified = !isEqual(baseTodo, remoteTodo);

  if (localModified && remoteModified && !isEqual(localTodo, remoteTodo)) {
    conflicts.push({ todoId: id, base: baseTodo, local: localTodo,
                     remote: remoteTodo, conflictType: "edit-edit" });
  }
  // Otherwise one side changed, or both made the same change: it merges itself.
  continue;
}
```

Conflicts are settled differently per app. The extension asks, with a quick pick, because you're sitting at the editor. The PWA can't: it syncs on window focus, often right before the phone sends the app to the background, so a blocking dialog would just get lost. It keeps the local version and records the conflict for review later.

## The Verified Write

The merge decides what to write. The write itself has to survive the missing compare-and-swap. So before every `PATCH`, the engine reads the file again. Simplified from `gistSyncEngine.ts`:

```ts
for (let attempt = 0; attempt < 3; attempt++) {
  const recheck = await this.client.readFile(this.gistId, fileName);

  // Only a genuine "file not found" lets us write without comparing.
  // A network error or a rate limit means we can't tell an absent file from a
  // peer's fresh content, so give up: remote untouched, baseline unmoved.
  if (!recheck.success && recheck.error?.type !== SyncErrorType.FileNotFoundError) {
    return { success: false, error: recheck.error };
  }

  if (current !== undefined && !isEqual(current, base)) {
    // Someone pushed while we were merging: merge again against what's there now.
    const remerged = await strategy.merge(base, data, current);
    data = remerged.merged;
    base = current;
    continue;
  }

  await this.client.writeFile(this.gistId, fileName, serialize(data));
  await this.saveCache(key, data, data); // what we wrote becomes the new baseline
  return ok;
}
// Still moving after 3 attempts: fail as retryable and try again next sync.
```

That comment about network errors is there because the first version got it wrong. Treating "the re-read failed" as "the file isn't there" meant a flaky connection could push over a peer's brand-new file and record it as clean. That's exactly the silent, permanent loss the verified write exists to prevent.

It doesn't close the gap completely. A push can still land between the re-read and the `PATCH`. But the window shrinks from "the whole merge" to one round trip, and a push that sees the file moving merges again instead of overwriting it.

## What the Tests Caught

This is the part I'd want an interviewer to ask about, because every one of these was a real bug, each one is in the commit history, and each now has a regression test pinning the fix.

**A missing baseline read as "delete everything".** A device with an empty cache (fresh install, cleared storage) compared its empty list with the gist and concluded the user had deleted everything. Then it pushed that. The rule now: a missing baseline is never evidence of a local edit. The device adopts the remote, or merges against an empty base so everything counts as an addition.

**Key order caused phantom conflicts.** A todo parsed from the gist and one built in code had the same content with different key orders. `JSON.stringify` saw them as different, so untouched items looked modified, identical content was pushed on every sync, and conflicts appeared out of nothing. Equality now compares canonical JSON with sorted keys, and the writer uses the same sorted form.

**Two copies of the same logic drifted.** For a while the extension had its own copy of the sync code while the PWA used the shared core package. Fixes were copied between them by hand, "byte-identical in both copies", and of course they drifted. The extension's equality check was plain `JSON.stringify`, its upload was a blind write saved as the baseline, and together that meant a concurrent push from the phone could be lost for good. The fix wasn't patching both copies again. The extension moved onto the shared engine and its copy was deleted. Two peers writing one file can't afford to disagree about anything.

**"Skip this conflict" deleted the item.** The resolver returned a complete list rather than just its decisions, so an item the user skipped was simply missing from it, and missing means deleted, on both devices. Decisions are now sparse: whatever the resolver doesn't decide falls back to the policy.

**New items sank to the bottom.** The merged list used to be rebuilt in the baseline's order, with everything else appended. The baseline order is the one order guaranteed to be stale, so every merging sync sent new items to the end and undid reorders. Now the local order is the skeleton, and items only the remote has are spliced in next to their neighbours.

**And the test suite that wasn't running.** The extension's sync tests existed, but the test runner's file glob didn't pick them up. They'd never run. That one's embarrassing in a very specific way: green CI, zero coverage.

## The Numbers

- 13 per-item merge rules, 4 of which are conflicts
- 3 verified-write attempts before giving up as retryable
- 3 requests per push (read, re-read, write), and 1 when nothing changed
- 149 test cases on the merge and the sync engine alone, 253 in the shared core package overall, with regression tests that pair "loses the edit without the guard" with "keeps it with the guard"
- 3 seconds of debounce before a push, so a burst of edits becomes one write

The shared engine and its fixes live on the release branch alongside the companion app.

## Trade-offs

Content-based merging has real costs. Every device needs a baseline. Two edits to different fields of the same todo still count as a conflict, because the merge works per item, not per field. And when both devices reorder the same items, one order wins (local's) rather than the two being merged, because the data model has no per-item position to merge.

CRDTs were the obvious alternative. At this scale they'd be machinery without a payoff: the gist holds plain JSON that existing users already have, and a single user syncing a few devices doesn't need it. But if lists are ever shared between people, or sync needs to be real-time, the gist stops being the right backend. The next step would be a small sync service: a relational table with one row per todo and a version number, conditional updates for real per-item compare-and-swap, and changes pushed over SSE or WebSockets instead of polling. The client-side merge would stay for offline edits.

## Lessons Learned

**Get the baseline right first.** Almost every bug above was really a question of "what do we compare against?" A wrong or missing baseline turns a correct merge into data loss.

**Equality is a design decision.** "Same content" has to mean the same thing on every device, byte for byte. Canonical serialization isn't polish; it's correctness.

**Never keep two copies of logic that two peers must agree on.** Shared code, compiled into both apps, is the only way they stay the same.

**Check that your tests run.** A test that never executes is worse than no test, because it makes you feel covered.

**When not to do this:** if you control the backend, use its concurrency tools. Row versions and conditional writes are simpler and stronger than anything you can build on top of a plain file store. This design earns its complexity only because the storage is a gist and the users bring their own.

The code is in the [vscode-todo repository](https://github.com/ai-autocoder/vscode-todo/tree/feat/mobile-pwa-companion/packages/core/src).
