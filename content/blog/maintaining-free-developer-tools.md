---
title: "What 16,000 Installs Taught Me About Maintaining Free Developer Tools"
date: "2026-07-02"
excerpt: "Four VS Code extensions, 16,000+ installs, zero marketing, zero telemetry. The honest economics of maintaining free developer tools, and why it pays off."
tags: [vscode, open-source, developer-tools, maintenance, marketplace]
readTime: 8
image: "../media/img/blog/maintaining-free-developer-tools.svg"
---

# What 16,000 Installs Taught Me About Maintaining Free Developer Tools

I maintain four VS Code extensions, published on both the VS Code Marketplace and Open VSX. Counting both registries, the installs look like this (September 2026):

- VS Code Todo: 9,100+
- Smart XML Diff: 4,100+
- Multi-Projects Diff: 2,000+
- Last Log: 850+

Just over 16,000 installs in total, built over roughly four years, with zero marketing. Not "we're a startup" numbers. But every one of those installs is a developer who went searching for a specific problem and chose to keep the tool.

This post is the honest ledger: what maintaining free tools actually costs, what the numbers mean and don't mean, and why I still think it's one of the best investments a working developer can make.

## The Numbers Lie in Both Directions

First lesson: marketplace numbers are noisy in ways nobody tells you.

Installs aren't users. Some fraction of installs are people who tried an extension for ten minutes and moved on. On the other side, installs undercount too: one install on a Settings-Synced account can mean several machines.

And for a long time I undercounted myself, badly. I treated Open VSX, the registry used by VS Code forks like VSCodium and Cursor, as a rounding error and quoted Marketplace numbers only. My own CV said roughly 2,400 installs. When I finally added both registries up properly, the real figure was over 16,000. That's my admission for this post: I spent months underselling the most verifiable thing I've built, because I never checked the number before writing the sentence.

The number I actually watch now is the split. Three of the four extensions have more installs on Open VSX than on the Marketplace. Multi-Projects Diff is the extreme case: about 380 on the Marketplace and over 1,600 on Open VSX. If I'd only looked at one registry, I'd have concluded almost nobody used it.

That's the second lesson: **know where your users actually are before you decide what's working.**

## What Maintenance Actually Looks Like

Here's the honest version: issues barely arrive. Most weeks nobody reports anything. That doesn't mean the tools are finished. I spend an hour or two on them most days, and almost all of it goes into building and testing new things rather than fixing reported bugs. Lately most of it has gone into VS Code Todo: the MCP server, sync across devices, and a browser companion app.

Quiet isn't the same as satisfied, though. With few issues and zero telemetry, silence is most of the feedback I get, and silence is hard to read. So I lean on automation instead. VS Code Todo's CI runs three jobs on every push: the sync engine's tests, the webview and PWA tests with a build check, and the extension's lint, compile and integration tests inside a headless VS Code. With nobody filing bug reports, the test suite is the closest thing I have to a user telling me something broke.

## The Zero-Telemetry Handicap (Worth It)

All four extensions are zero-telemetry: no usage tracking, no analytics, nothing reported back to me. For developer tools that sit inside codebases, I consider that table stakes.

But I'd be lying if I said it was free. I don't know which features people use. Put that together with a quiet issue tracker and I'm often building on judgment rather than data: my own daily use, and the problems I run into at work.

That's the trade: privacy as a feature costs you product information. I'd make the same call again, but it's a call, not a freebie.

## What the Tools Return

Nobody pays me for these extensions. The return shows up elsewhere, and it's concrete:

**They're proof of work.** A hiring conversation changes when you can point at shipped software with real users, public code, and install counts anyone can check on two registries. It demonstrates the unglamorous skills (backwards compatibility, testing, release discipline) that a CV can only claim.

**They compound skills.** The extensions forced me into proper TypeScript, VS Code's API, state management across process boundaries, and lately the Model Context Protocol, each learned against real users rather than tutorials.

**They started as internal tools.** At least two of the four, Multi-Projects Diff and Last Log, began as solutions to problems in my day job, where the team's internal tooling now gets a release out to eight customers in less time than one used to take by hand. Publishing generalized versions was almost free, and the discipline flowed backwards: public code standards improved my private code too.

## Lessons Learned

**Solve your own problem first.** Every extension I've published came from a real itch. The install count then tells you how many people share it.

**Count everywhere you publish.** Two registries, two very different pictures. Check both before you draw a conclusion, and definitely before you put a number on your CV.

**Discoverability is the ceiling.** The Marketplace has tens of thousands of extensions. Search is your only distribution unless you do marketing, so the listing (title, description, screenshots, first-run experience) matters as much as the code.

**Let tests stand in for users.** When feedback is rare, the test suite has to catch what users won't report. It's the cheapest insurance a solo maintainer can buy.

**When not to do this:** if you're after passive income or fame, free extensions are a terrible vehicle. The value is skills, credibility, and proof you can point at. If that list sounds thin to you, spend the weekends elsewhere. To me it still reads like a bargain.
