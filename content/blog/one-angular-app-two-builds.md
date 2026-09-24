---
published: false
title: "One Angular App, Two Builds: A VS Code Webview That's Also a PWA"
date: "2026-09-18"
excerpt: "The phone app for my VS Code extension isn't a second UI. It's the same Angular webview, built with a different configuration and one swapped-out bridge."
tags: [angular, pwa, architecture, typescript, vscode, frontend]
readTime: 7
image: "../media/img/blog/one-angular-app-two-builds.svg"
---

# One Angular App, Two Builds: A VS Code Webview That's Also a PWA

VS Code Todo's interface is an Angular app running inside a VS Code webview. It renders Markdown, Mermaid diagrams and KaTeX, handles tags and drag-and-drop, and it's the UI that 9,000+ installs have been using.

So when I built Plans, a companion PWA that opens the same lists on a phone, the expensive mistake would have been writing a second UI. Two implementations of Markdown rendering, two sets of tag rules, two drag-and-drop behaviours, drifting apart from day one.

Plans isn't a second UI. It's the same Angular app, built with a different configuration, with one component swapped out underneath it. This post is about where that seam sits and why it's a build-time decision rather than a runtime one.

## The Seam Was Already There

A VS Code webview can't touch the disk or the network directly. It talks to the extension host by message: the UI posts a command, the host updates its Redux store, and the host sends state back. The UI never holds authoritative state. It renders whatever the host last sent.

That contract lives in one file: 31 commands from the webview to the host, and 7 messages back. The payload types are derived from the Redux action creators, and the webview imports that same file, so changing a reducer's signature is a compile error in the UI. That turned out to be the most valuable line of defence in the whole design.

Here's the insight that made the PWA cheap: if the UI only ever talks in messages, it doesn't care who answers. In VS Code, the extension host answers. In a browser, something else can, as long as it speaks the same protocol.

## Swapping the Bridge

In the webview, messages go out through `acquireVsCodeApi()`. Outside VS Code that function doesn't exist, so the wrapper falls back to a delegate that someone else installs:

```ts
// The UI always posts through this wrapper. Inside VS Code the real API
// takes precedence; in the PWA, the shell installs a delegate instead.
if (typeof acquireVsCodeApi === "function") {
  this.vsCodeApi = acquireVsCodeApi();
}

public setPostMessageDelegate(delegate: (message: unknown) => void) {
  this.postMessageDelegate = delegate;
}
```

In the PWA, a shell component installs that delegate. Each message is routed to a `GistGateway`, which does what the extension host would do (read and write the user's gist, keep a local copy in IndexedDB) and replies in exactly the host's message shapes. The shell posts those replies back with `window.postMessage`, and the unmodified UI handles them as if the extension had sent them.

The gateway is held to the same contract by its types: each command it implements is typed from the extension's own message definitions. If the extension's protocol changes, the PWA stops compiling until it catches up.

## Why a Build-Time Swap, Not a Runtime Flag

The obvious approach is an `if`: detect whether you're in VS Code, and dynamically import the right bridge. I didn't do that, and the reason is a security header.

The webview's Content Security Policy only allows scripts that carry a nonce. A dynamic `import()` makes the bundler split the code into a separate chunk, and chunks loaded that way don't inherit the nonce. So the runtime approach breaks inside VS Code, which is the environment with 9,000+ users.

Instead, Angular builds the app twice. The `pwa` build configuration swaps three files at build time:

```json
"pwa": {
  "index": { "input": "src/index.pwa.html", "output": "index.html" },
  "fileReplacements": [
    { "replace": "src/environments/environment.ts",  "with": "src/environments/environment.pwa.ts" },
    { "replace": "src/bootstrap.ts",                 "with": "src/bootstrap.pwa.ts" },
    { "replace": "src/app/data/data.providers.ts",   "with": "src/app/data/data.providers.pwa.ts" }
  ],
  "serviceWorker": "ngsw-config.json",
  "outputHashing": "all"
}
```

A nice side effect: the extension build contains no PWA code at all. None of the gist client, the device-flow sign-in or the IndexedDB stores ends up in the VSIX. The only files that are PWA-only are the ones the swap reaches; everything else is shared by default.

## What the Phone Needed That the Webview Didn't

**Theme variables.** Inside VS Code, the editor injects `--vscode-*` CSS variables and the UI styles itself from them. The PWA supplies its own set in one stylesheet, so the same components render the same way.

**Touch targets.** Mobile rules (48 px targets, larger text, always-visible row actions) sit under `@media (pointer: coarse)`, keyed to the pointer rather than the screen width. A phone in landscape is wide, but it still has a finger for a pointer.

**Installability.** A manifest, Angular's service worker, and headers that serve the service worker, the manifest and `index.html` with `no-cache`, so no phone gets pinned to an old build. The service worker caches the app shell only. API responses are never cached; offline data comes from IndexedDB.

## What Went Wrong

**The PWA woke up and deleted everything.** On a cold start, the app began with an empty list while its sync baseline still held the real one. The sync compared the two, concluded the user had deleted everything, and pushed that. The fix restores the lists from the local cache before any sync can run, and a device with a token, a gist and a file stored now reaches "connected" without a network call.

**A build that succeeds can still be the wrong build.** Both targets share one output directory. The extension build writes an unhashed `main.js` (the host loads it by name), and a PWA build afterwards didn't remove it, so a deploy could upload a stale file from the other target. The deploy script now clears the directory first. And because a build with the wrong configuration still exits 0, CI checks the PWA output itself: `app-pwa-shell` in `index.html`, plus the manifest, the service worker and the Pages headers.

**Some leftovers are still there.** The webview's npm package and Angular project are still called `hello-world`, straight from the extension template. And the extension build registers a `VsCodeGateway` it never actually constructs; moving the UI onto a gateway in both builds is deferred. Neither is dangerous, but I'd rather list them than have someone find them.

## The Numbers

- 1 Angular codebase, 2 shipped builds, 3 files swapped at build time
- 31 commands and 7 messages in the typed webview contract
- 0 PWA-only modules in the extension build: no gist client, no sign-in, no IndexedDB
- 138 Karma specs across the shared components, the gateway, conflict review and the PWA shell
- 48 px touch targets on any coarse pointer, whatever the screen width

## Trade-offs

Shared by default cuts both ways. Any change outside the PWA-only files changes both products, and the extension half only reaches users with the next Marketplace release while the PWA can deploy the same day. So the two can briefly be out of step. There are also two builds to verify on every change, which is why CI builds both.

The alternative, a separate mobile app, would have given the phone a UI designed for it from scratch. It would also have meant maintaining every rendering feature twice for a free side project. For this product, one implementation wins easily.

## Lessons Learned

**Design the seam before you need it.** The webview's message protocol was written for VS Code's security model, not for a future phone app. It made the PWA possible anyway, because a UI that only talks in messages doesn't care who's listening.

**Let the types enforce the contract.** Deriving every message type from one source file meant the extension, the webview and the PWA couldn't quietly disagree.

**Check your security constraints before your architecture.** The nonce-only CSP ruled out the obvious runtime design. Finding that late would have been expensive.

**Verify outputs, not exit codes.** A build that exits 0 with the wrong configuration is still a broken release.

**When not to do this:** if the second platform needs a genuinely different interaction model, or the shared UI would have to fork for it, build a separate app. Sharing a UI only pays when the two products really do the same job.

The code is in the [vscode-todo repository](https://github.com/ai-autocoder/vscode-todo/tree/feat/mobile-pwa-companion/webview-ui).
