---
title: "Building Developer Tools That Your Team Will Actually Use"
date: "2025-02-15"
excerpt: "I've built four internal tools. Three gathered dust. One is used daily by 15 developers. Here's what made the difference between 'nice idea' and 'can't work without it.'"
tags: [developer-tools, productivity, vscode, automation, team]
readTime: 15
---

# Building Developer Tools That Your Team Will Actually Use

I've built four internal developer tools. Three are dead. One is used daily by the entire team two years later.

Here's the scorecard:

1. **Automated code formatter** - Used for 2 weeks, abandoned
2. **Custom Git workflow script** - Just me, nobody else
3. **Database schema visualizer** - Demoed once, never touched again
4. **Multi-Projects Diff VS Code extension** - Used daily by the entire team, every single day

What made the difference?

Not clever architecture. Not perfect code. It's about solving the right problem in a way people actually want to use.

## The Tool Nobody Used: Automated Code Formatter

Our team had inconsistent code style. Tabs vs spaces, quote styles, indentation. It looked messy in code reviews.

So I spent a weekend building a custom formatter that enforced our style guide automatically. It was smarter than Prettier in some ways. I was pretty proud of it.

Nobody used it.

**The problem**: I never asked if anyone actually cared.

Turns out everyone already had formatters they liked. Prettier, ESLint auto-fix, whatever. My tool was "better" in ways that didn't matter to them. They'd rather keep their existing setup than learn a new one for marginal gains.

I should've asked "is this actually painful for you?" before writing a single line. Would've saved me a weekend.

## The Tool Only I Used: Git Workflow Script

I got tired of typing this every time I needed a new branch:

```bash
git checkout main
git pull
git checkout -b feature/new-thing
git push -u origin feature/new-thing
```

So I wrote a bash script:

```bash
gnb feature/new-thing  # "git new branch"
```

Saved me 30 seconds per branch. Used it constantly.

I showed it to the team. Got a couple of "neat" comments. Nobody installed it.

Took me a while to figure out why. The rest of the team used GUI tools. VS Code's Git panel. GitKraken. They weren't typing git commands at all.

I'd built a solution to a problem only I had. My workflow wasn't their workflow.

## The Tool That Looked Great But Died: Database Schema Visualizer

Our PostgreSQL database had 50+ tables. Foreign keys everywhere. New developers kept getting lost trying to figure out how everything connected.

So I built a web-based schema visualizer. Spent three weeks on it. Interactive graph of all tables and relationships. Click a table, see its columns and foreign keys. Search and filter. The whole thing.

It looked fantastic in the demo. People were impressed.

And then nobody used it.

New developers would look at it once during onboarding. Then never open it again. The problem was understanding the schema once, not repeatedly. After you got the mental model, you didn't need the tool anymore.

Three weeks of work for something people used one time.

Looking back, I should've just drawn a diagram in Figma and added it to the docs. Would've solved 80% of the problem in an hour instead of three weeks building a tool nobody needed long-term.

## The Tool That Actually Worked: Multi-Projects Diff

Here's the situation: we maintained eight versions of the same codebase. Each one was a client customization. When we added a feature or fixed a bug, we had to sync it across all eight.

The process was brutal:

1. Make a change in Project A
2. Open Project B, find the same file
3. Manually compare and figure out what to merge
4. Copy the changes over
5. Repeat for C, D, E, F, G, H
6. Hope you didn't miss anything

This happened every single week. Sometimes twice a week. It took 2-4 hours every time.

Everyone on the team hated it. In standup one day I asked "how long did syncing take you this week?" The answers ranged from 2 to 4 hours. One person said they'd spent half a day on it because they'd missed a file and had to redo everything.

### What Made It Work

Before writing any code, I asked the team: "If I made a VS Code extension that showed all 8 projects side-by-side and highlighted differences, would you actually use it?"

Three people said "yes, please." Two said "I'd try it." One said "meh."

That was enough. At least three people wanted it.

Version 1 was embarrassingly simple. I built it in about 4 hours one Saturday:
- Compare the current file across just 2 projects (not all 8)
- Show diffs in the terminal output (no UI)
- Project paths hardcoded in the source

I showed it to the team Monday morning. They said "this is actually useful, but can it handle all 8 projects? And show the diffs in a panel instead of the terminal?"

So I spent another few hours adding that. Then people started using it.

Real usage drove everything after that. Someone said "I want to pin one project as the reference and compare the others against it." Added it. Someone else wanted the diffs to auto-update when they switched files. Added watch mode.

The key was that it lived in VS Code. No separate app to open. No context switching. You're already in the editor, you hit a keyboard shortcut, boom, diffs appear.

And the pain was real. Recurring. Everyone felt it. A tool that saved 3 hours per week was absolutely worth building and maintaining.

## Will Your Tool Actually Get Used?

Here's what I ask before building anything:

**Is the problem painful enough?** If someone says "yeah, that's annoying," it's not enough. You need "I waste 2 hours a week on this." Simple test: would someone pay $50/month to solve it?

**Is it recurring?** One-time problems need documentation, not tools. "I do this every day" beats "I had to do this once."

**Do multiple people feel this pain?** If it's just you, it's a personal quirk. I look for at least 3 people who say "yes, I feel this pain."

**Can you build an MVP in under 8 hours?** If it takes weeks, the problem's too complex or poorly defined. Core functionality in one sitting.

**Does it fit existing workflows?** Tools that make people switch context die fast. CLI commands work. IDE extensions work. "Open this web app in another tab" doesn't.

**Is there already a solution?** Don't rebuild Prettier or Git. But if existing solutions don't quite fit your specific problem, that's when custom tools make sense.

## Real Examples from My Team

### Tool That Worked: Automated Test Data Generator

**Problem**: Writing test data manually was tedious. Developers copy-pasted old test data, which broke when schemas changed.

**Solution**: CLI tool that generates realistic test data from database schemas.

```bash
testgen users 10  # Generates 10 users with realistic names, emails, etc.
```

**Why it worked**:
- Painful? Yes (developers spent 30min/day writing test data)
- Recurring? Yes (every test needs data)
- Multiple people? Yes (whole team)
- Quick to build? Yes (weekend project)
- Fits workflow? Yes (CLI, they're already in the terminal)

**Result**: Used daily. Saved ~2 hours/week per developer.

### Tool That Failed: Custom Linter

**Problem**: ESLint didn't catch some team-specific patterns we wanted to enforce.

**Solution**: Custom ESLint plugin with our rules.

**Why it failed**:
- Painful? Kinda (inconsistent patterns were annoying, not critical)
- Recurring? Yes
- Multiple people? Only 2 people cared strongly
- Quick to build? No (took 2 weeks)
- Fits workflow? Yes

**Result**: I spent 2 weeks building it. 2 people used it. Then we switched to Prettier and the problem disappeared.

Two weeks of work for something that barely mattered. Sometimes the answer isn't building a new tool. It's configuring existing tools better.

## How I Build Tools Now

Talk to 3-5 people first. Ask "how much time do you spend on this per week?" and "would you actually use a tool that solves this?" If fewer than 3 people say "absolutely yes," I stop.

Then I build the embarrassing MVP. Hardcoded paths. No error handling. No tests. Ugly UI. The only goal is proving the core idea works. Takes 4-8 hours.

I give it to 2 early adopters and watch them use it. If they don't touch it after 3 days, the idea's dead. If they do, I ask what's missing and add those features.

Red flag: if I'm the only one using it after 2 weeks, it's not solving a real problem.

Only after it's being used daily do I clean it up with tests, docs, and proper error handling. Most tools die before this step, so there's no point doing it early.

## Mistakes I Made

### Building What I Thought Was Cool

I built a code complexity analyzer because the idea was interesting. Nobody asked for it. Nobody used it.

Build what's needed, not what's interesting to you.

### Solving the Wrong Part of the Problem

Developers complained: "Database migrations are painful."

So I built a tool to auto-generate migrations. Nobody used it.

Turns out the pain wasn't generating migrations. It was understanding what schema changes were safe to run in production. I'd solved the wrong problem.

### Over-Engineering Version 1

I spent 3 weeks on that schema visualizer. React UI, database, search, filters, the works.

If I'd spent an hour drawing a diagram in Miro, it would've solved 80% of the problem.

Start with the simplest possible solution. Even if it's not code.

### Not Asking for Feedback Early

I built a tool in secret for 2 weeks, then showed the team. "This doesn't fit how we work," they said.

Show ugly prototypes early. Course-correct before you've invested weeks.

### Building for the Wrong Platform

I built a web app. Developers didn't want to open a browser. They wanted a CLI or IDE extension.

Ask where people would actually want to use it before you decide on the tech stack.

## The Uncomfortable Truth

Most internal tools aren't worth building.

Before you write code, try:
- Better documentation
- Existing open-source tools
- Process changes
- Manual solutions (sometimes "we'll just do it manually" is the right answer)

But when you find a real, painful, recurring problem that affects multiple people? Build the simplest possible solution fast.

Don't over-engineer it. Don't make it perfect. Make it work.

If people use it for a month, improve it. If they don't, move on.

## What Actually Matters

The best developer tool isn't the one with the most features or the cleverest algorithm. It's the one your team can't imagine working without.

I've built four internal tools. Three are dead because I solved problems that didn't exist or weren't painful enough. One is still running on 15 machines two years later because I validated the pain first, built something embarrassingly simple, and let real usage drive every decision.

Small, focused, solves recurring pain, fits existing workflow. That's the pattern that works.

Multi-Projects Diff saves 3 hours per week. Testgen saves 2 hours per week. Both are used daily two years later. Not because they're technically impressive, but because they solve real problems people actually have.

That's the difference between "nice idea" and "can't work without it."

Building developer tools has become one of my favorite areas. There's something deeply satisfying about solving a problem once and watching it help people every single day.

