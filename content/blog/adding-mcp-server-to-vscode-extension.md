---
title: "An MCP Server Inside a VS Code Extension: What It Took"
date: "2026-07-14"
excerpt: "AI agents in the editor couldn't see the todos next to them. How a local MCP server inside the extension host fixed it, and what agents need that people don't."
tags: [mcp, vscode, nodejs, typescript, security, ai]
readTime: 8
image: "../media/img/blog/adding-mcp-server-to-vscode-extension.svg"
---

VS Code Todo keeps todos and notes inside the editor, scoped to your profile, your workspace or a single file. It's published on both the VS Code Marketplace and Open VSX.

Then AI agents moved into the editor, and there was an obvious gap. An agent working in my workspace could read every file in it, but not the task list sitting in the sidebar. The lists live in the extension's own state, not in the repo, so to the agent they didn't exist.

Version 2.2.0 closed that gap with a built-in server for the Model Context Protocol (MCP), the protocol AI clients like Claude Code and Cursor use to call tools you define. This post covers the transport decision, what it takes to open a port on someone's machine responsibly, and four places where agent traffic needed things human traffic never did.

## Why HTTP Inside the Extension, Not stdio

Most MCP servers are separate processes. The client launches your binary and talks JSON-RPC over stdin and stdout.

That doesn't fit here. The lists live in the extension host: a Redux store, the webview, file watchers, sync with GitHub Gist. A separate process would need its own copy of that state, or a channel back into VS Code to reach it.

So the server runs inside the extension host itself: a Node `http` server bound to `127.0.0.1`, speaking the SDK's Streamable HTTP transport at `/mcp`. Every write goes through `TodoService`, the same layer the UI's changes reach, and for the list open in the panel it dispatches the same Redux actions the UI does. An edit made by an agent is persisted, synced and shown in the panel like one you typed.

Two smaller decisions came with it. Each MCP session gets its own server instance, keyed by a UUID, so several agents can connect at once. And replies are plain JSON rather than a Server-Sent Events stream (commit `92a892a`), because the server never pushes notifications of its own. A stream nobody uses is just one more thing to keep open.

The costs are real. The server only exists while VS Code runs, the PWA version of the app can't have one at all (a web page can't listen on a socket), and there's now a port on the machine. That last one deserves its own section.

## A Port on localhost Is Not Private

Binding to `127.0.0.1` keeps the network out. It doesn't keep out every other process on the machine, and it doesn't keep out a web page in your browser, which can send requests to localhost too. So the server is off by default, and every request passes these checks, in this order:

1. **Workspace trust.** In an untrusted workspace the server doesn't start, and requests get a 403.
2. **Origin.** A request with no `Origin` header is allowed, because CLI clients don't send one. A request that does send one must come from a loopback origin. That blocks DNS rebinding, where a malicious site points its own hostname at `127.0.0.1` to get past the browser's same-origin rules.
3. **Path.** Anything but `/mcp` gets a 404.
4. **Token.** Optional. If you set one, requests need `Authorization: Bearer <token>`.
5. **Session.** A request without a known session ID must be an `initialize` call.

The token check uses a constant-time comparison (commit `c5bd425`), so response timing can't reveal how much of a guessed token was right. From `McpServerHost.ts`:

```ts
// Constant-time comparison to avoid leaking the token via response timing.
private tokensEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  // timingSafeEqual requires equal-length buffers; differing lengths mean a
  // mismatch, but still run a same-length compare so timing does not reveal it.
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}
```

Beyond the gates, the defaults are conservative. Write tools refuse unless you turn `readOnly` off. `allowedScopes` can take the file-level lists out of reach entirely. And when a tool throws, the full error and stack go to the extension's log channel, while the client only sees the curated message (commit `e6db832`). Internal objects don't cross the MCP boundary.

None of this changes the extension's privacy stance: it doesn't collect telemetry or analytics, and the MCP server doesn't add a data path off the machine. Which client you connect it to is your call.

## What Agents Need That People Don't

A person opens the panel, reads a few dozen items and edits one at a time. An agent calls tools in bursts, repeats itself and doesn't care how big a response is. Four parts of the server exist because of that difference. The first two were fix commits.

### 1. Two write paths, and only one was idempotent

The webview owns the state of the file list you're looking at, but an agent can address any file in the workspace. So `TodoService` has two write paths: dispatch a Redux action when the target is the active list, or change the persisted data directly when it isn't.

The dispatch path already skipped no-op changes. The direct path didn't, so marking an already-completed item as completed gave it a new completion date. For a tool an agent might call twice, that's a bug. The fix in `294c359` is four lines plus a test:

```ts
mutateFile: (todo) => {
  // Idempotent: leave an already-matching item (and its completionDate) untouched.
  if (todo.completed === completed) {
    return;
  }
  todo.completed = completed;
  todo.completionDate = completed ? new Date().toISOString() : undefined;
},
```

Two write paths for one operation is exactly where this kind of drift hides. Each one looked correct on its own.

### 2. Sessions that never say goodbye

The session map grows by one on every `initialize`. A client that reconnects without a clean `DELETE` leaves its old session behind, forever. Commit `57ac671` caps the map at 50 and evicts the least recently used session. A JavaScript `Map` iterates in insertion order, so moving a session to the end on every use makes the first key the oldest:

```ts
private touchSession(sessionId: string): SessionEntry | undefined {
  const entry = this.sessions.get(sessionId);
  if (entry) {
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, entry);
  }
  return entry;
}
```

No extra data structure, no library, and eviction is one `keys().next()` away.

### 3. Pages measured in characters, not items

`todo_list_items` pages by count, 50 items by default. But notes can hold long Markdown, so 50 items can be a few hundred bytes or several megabytes, and a megabyte response eats an agent's context.

Commit `8110664` adds a second limit: a character budget per page, 100,000 by default and adjustable per call. The page is trimmed to whole items and returns `has_more` with the offset to resume from. One rule matters more than the budget itself:

```ts
// Always keep the first item even if it alone exceeds the budget, so paging progresses.
if (kept > 0 && used + size > maxChars) {
  break;
}
```

Without it, a single note bigger than the budget would produce an empty page with `has_more: true`, forever. Behind all of this sits a hard 2,000,000-character cap on any tool or resource response (commit `a287970`), which realistic payloads never reach.

### 4. A preference that reverses a plan

The extension lets you choose whether new items land at the top or the bottom of a list. With "top" selected, an agent writing a five-step plan through five separate add calls gets step five at the top and step one at the bottom. Every call honours the setting correctly. Honouring it five times in a row is what reverses the plan.

Commit `cf3ec7f` fixes it in two parts: an optional `position` on the single-add tool, so a caller can override the preference, and a batch tool, `todo_add_items`, that inserts an ordered list as one block. The batch defaults to appending, so a plan reads top to bottom whatever the setting says.

## Todos as Agent Memory

The tools are only half of it. The README ships a block to paste into a project's `CLAUDE.md` or `AGENTS.md`. It tells the agent that, when the `todo_*` tools are connected, the list is the source of truth for outstanding work. The agent reads it before searching the repo, saves a multi-step plan in the workspace scope under one shared tag, and marks steps complete instead of deleting them. It also says when not to bother: quick questions and one-off edits don't need a tracker.

The shared tag is what makes it memory rather than a scratchpad. A plan is just the items carrying one tag, so a fresh session the next day, with no context at all, can pull back exactly that plan and see which steps are done. The extension's own repository uses the same block in its `AGENTS.md`.

## The Numbers

- 11 `todo_*` tools and 5 resources, shipped in 2.2.0
- 88 tests: 65 on `TodoService`, the layer every tool writes through, and 23 on the server's request handling
- 5 request gates, checked in a fixed order; off by default, read-only by default
- 50 concurrent sessions before the least recently used is evicted
- A 100,000-character default page budget, with a 2,000,000-character backstop

## What's Still Open

Two limitations are worth knowing before you turn it on.

**Auth is off by default.** Once you enable the server without a token, any local process can call it. Read-only mode limits the damage, but a token is the real control, and it's opt-in.

**Stale sessions get a 400, not a 404.** The Streamable HTTP spec says an unknown session ID should get a 404, which tells the client to start a new session. This server answers 400, so a client whose session was evicted doesn't recover on its own. It's a fix I haven't made yet.

## Lessons Learned

**The protocol was the small part.** Wiring up the SDK took a fraction of the effort, and I did most of it with Claude and its MCP builder skill. Making the extension's state safe for a second, very different writer was the rest, and the idempotency fix improved the extension whether or not an agent is connected.

**Localhost is an attack surface.** "It only listens on 127.0.0.1" is where the security thinking starts, not where it ends. Browsers can reach localhost, and so can every process on the machine.

**Write limits in the unit the consumer pays in.** For an agent, the cost of a response is its size, not its item count. A page of 50 items was the wrong unit. Characters were the right one.

**When not to do this:** if your extension's data already sits in the workspace as files, agents can read it without you, and an MCP server just adds surface. It earns its place when the state is internal to the extension, like scoped todo lists, and invisible to anything reading the filesystem.

The MCP server's code is in the [vscode-todo repository](https://github.com/ai-autocoder/vscode-todo/tree/master/src/mcp), and the extension is on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=FrancescoAnzalone.vsc-todo).
