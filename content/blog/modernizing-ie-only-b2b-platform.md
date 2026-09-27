---
title: "Modernizing an IE-Only Front End With No Tests and 40+ Variants"
date: "2026-09-27"
excerpt: "An IE-only B2B front end, no test suite, and 40+ customer and version variants. Why the safety net for modernizing it turned out to be tooling, not a rewrite."
tags: [legacy-code, migration, javascript, frontend, developer-tools]
readTime: 7
image: "../media/img/blog/modernizing-ie-only-b2b-platform.svg"
---

# Modernizing an IE-Only Front End With No Tests and 40+ Variants

For the last four years I've worked on the front end of a B2B platform that customers run their business on. When the work started, that front end ran in one browser: Internet Explorer.

Not "worked best in IE". Only IE. ActiveX-era code, event handling through `attachEvent`, element lookups through `document.all`, and browser sniffing that actively turned other browsers away. What forced the change wasn't a strategy meeting. Microsoft ended support for Internet Explorer, and a front end that only runs in IE stops being an option on Microsoft's schedule, not yours.

Today it runs in Chrome, Edge and Firefox, and IE support is gone. This post isn't a step-by-step migration guide. It's about the two things that made the job hard, and the tools that turned out to be our safety net.

## The Easy Part Was the Browser APIs

The IE-only patterns themselves are well understood. Every one has a standard replacement, and the idea fits in a few lines. Illustrative, not from the codebase:

```js
// Before: works in IE, nowhere else.
var panel = document.all['summary'];
panel.attachEvent('onclick', toggleSummary);

// After: standard DOM, every modern browser.
const panel = document.getElementById('summary');
panel.addEventListener('click', toggleSummary);
```

If that were the whole job, it would be a long afternoon of search and replace. It wasn't, for two reasons.

## The Hard Part: No Tests, and Many Copies

**There's no automated test suite.** Not in the legacy code, and not in the modernized screens either. Nothing automated tells us whether a change has broken a screen; someone has to open that screen and look at it. On a platform customers run their business on, "we'll find out" isn't a strategy.

**The front end doesn't exist once.** Each customer has its own variant, and each customer runs several versions of the product. That adds up to more than 40 customer and version workspaces. A fix to one template can need checking in all of them, and the variants are similar but not identical, so you can't copy a file across and hope.

The stack around it is what you'd expect of a system this age: vanilla JavaScript, HTML, SASS, a Grunt build and SVN.

A rewrite would have hit both problems head-on. You can't check a rewrite of untested behaviour against anything, and you'd be rewriting 40-plus variants of it. So the platform was modernized in place, while customers kept using it. Without tests, that raised a different question: if nothing automated tells you a change is right, what does?

Our answer was tooling that makes the comparison visible, so a person can check it quickly.

## Safety Net 1: See Every Variant at Once

Most diff tools compare two files, sometimes three. Checking one template across 40-plus workspaces with them isn't slow, it's simply impractical.

I built a VS Code extension for exactly this: it shows how the current file differs across every configured project in a sidebar, with split diffs and actions to copy a change or create the file in a target project. It started as a tool for this work and is now public as [Multi-Projects Diff](https://marketplace.visualstudio.com/items?itemName=FrancescoAnzalone.multi-projects-diff), with over 2,000 installs across the VS Code Marketplace and Open VSX.

It doesn't replace judgment. But it puts all the differences in front of the person making the call, which is the part that was missing.

## Safety Net 2: Find the Log Fast

When something breaks, the first job is finding the newest log file in a deep folder structure. It's a small job that comes up over and over. A tiny extension that opens the most recent log with one command took that friction away. It's public too, as [Last Log](https://marketplace.visualstudio.com/items?itemName=FrancescoAnzalone.vscode-last-log).

## Safety Net 3: Reuse Before You Rebuild

A codebase this size has a lot of HTML templates, and a new screen could easily get built from scratch when something close to it already existed. I built a tool, on my own, that finds near-duplicate templates across the repositories. New screens start from an existing template and get adapted, which is less work and keeps the screens more consistent with each other.

## Safety Net 4: Review Against the Other Customers

Changes get reviewed by the UI team, with reviewers taking turns. I now run my reviews with an AI setup that reads the change and compares it with other customers' versions of the same screen, then I read the code myself and test in the browser. The AI is a help, not the reviewer of record. I wrote about [how that read-only reviewer is set up](read-only-ai-code-reviewer.html) separately.

Another small bot supports the same process from the other side. Other teams change UI code in our repository too, so every morning at 8am it scans SVN for their UI changes and opens a review card for each one on the team's Trello board. I'm its only maintainer, and I look after its deployment too.

## Safety Net 5: Releases That Don't Depend on Memory

A change that has to reach several customers, each on several versions, means many commits and many releases. By hand, every one is a chance to mistype an issue number or miss a branch.

The team automated it with two tools. A desktop app commits one change to every branch that needs it, with each customer's own issue number in the message. A colleague wrote most of it, with a lot of AI help; I proposed it and shaped what it does and how it looks. A browser extension then runs the release for each issue number. I co-wrote that one and I'm now its sole maintainer.

Together they mean a release to up to eight customers, each across several versions, now takes less time than one customer on one version used to take by hand. That's the team's result, and it's the one I'd point to first.

## Where the Code Is Now

- The front end runs in Chrome, Edge and Firefox, and IE support has been dropped
- Modernized code is ES6+ JavaScript and SASS, with some screens built in Vue
- jQuery is still in parts of the code; removing it is planned, not done
- One template can be compared across 40+ customer and version workspaces at once
- A release to up to eight customers, each on several versions, takes less time than one customer and version took by hand
- Two of the tools that came out of this work are public extensions anyone can install

## Lessons Learned

**Without tests, invest in visibility.** This front end has no automated tests, in the old code or the new. What we could build was the ability to see every variant, every log and every similar template at a glance. It isn't the same as a test, but it turns "we'll find out" into "we checked".

**Frequent small pains are worth a tool.** None of these tools is sophisticated. Each one removes a step that came up constantly, which is why they got used.

**Be exact about who built what.** Half of this safety net is team work. Saying so plainly costs nothing, and it's the only version of the story that survives someone asking a follow-up question.

**When not to do this:** if a system is small, well tested or about to be replaced, modernizing in place with tooling around it is overkill. It earns its cost when the system is large, used every day and copied across many variants, which describes a lot of legacy code that's worth saving.
