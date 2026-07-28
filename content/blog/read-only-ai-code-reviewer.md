---
title: "Claude Code as a Code Reviewer: A Read-Only Subagent and Guard Hooks"
date: "2026-07-28"
excerpt: "How a read-only Claude Code subagent helps review a legacy UI migration, why hooks guard the risky actions, and what I still check by hand in every review."
tags: [ai, code-review, claude-code, legacy-code, developer-tooling]
readTime: 7
---

# Claude Code as a Code Reviewer: A Read-Only Subagent and Guard Hooks

My team is rebuilding a legacy UI one screen at a time, while customers keep working in the old one. Every branch holds both versions: the legacy UI, which must not change, and the new one, where all the work happens.

Code review on the team runs on a rotation. Work is committed to SVN, the UI team tracks it on Trello cards, and a company-wide issue tracker handles the rest, releases included. When it's your turn, you're the one checking.

Reviewing a migrated screen isn't really about reading the diff. It's about comparing the new screen with the legacy one it replaces. Done by hand, line by line, that takes hours. And the mistakes that matter are small: a tag that never gets closed, a syntax error that only shows up under certain conditions, a data path that points at the wrong place, a field that quietly differs from its legacy version.

So I built a Claude Code setup to help with that, and made the part that reviews read-only.

When it's my turn on the rotation, I don't drive it step by step. I tell Claude to validate the changes, and it picks the skills and subagents it needs. Not everyone on the team writes code with AI, so a lot of what I review is written by hand. Then I read the code myself and test the screen in a browser. The AI review is a help, not the review.

## What's in the setup

The config lives in its own repo, and it's the team's only official AI setup. Not everyone uses AI, or not all the time, but when they do, this is what they use. It isn't only for review either: the same agent migrates screens and fixes issues, and it can read tickets from the company issue tracker through an MCP server. This article is about the review side.

It has 6 subagents, 10 skills, 2 guard hooks and 6 boilerplate templates. The agent and skill instructions come to about 3,200 lines, and the docs they point to add about 4,500 more. The repo has 73 commits since January.

More than 7,700 lines would swamp a model if they all loaded at once. They don't. The setup uses progressive disclosure: only 241 lines load at the start of a session, `CLAUDE.md` plus three small files it imports with `@` (a docs index, an overview and a glossary). Everything else is a plain markdown link. An `@` import pulls the file into context as soon as the session starts, while a plain link lets the agent read it only when the task calls for it. Skills work the same way. The agent sees a short description of each one and loads the full instructions only when it triggers one. And subagents are focused helpers that each run in their own context, so the reviewer's instructions never crowd the main session. Everything in the context window competes for the model's attention, so what stays out of it matters as much as what goes in.

## A reviewer that only reports

The code-review subagent is read-only by design. Here's the top of its definition, trimmed, with the product name taken out:

```markdown
---
name: migration-parity-reviewer
description: Validate that a migrated template is faithful to its legacy
  template in the same branch. Use after any screen migration, before
  considering it done. Produces a verdict, discrepancy list,
  syntactical-error list, and migration-rule-violation list.
  Read-only: never edits files.
tools: Read, Grep, Glob
---

You are a read-only auditor for this codebase.
Never edit, create, rename, or delete any file. Your tools are Read, Grep, Glob only.
Do not propose fixes; your job is to report. The caller decides what to do.
```

The `tools` line is what actually enforces it: no edit tool, no write tool, no shell. The instructions say the same thing in words, but the tool list is the part the model can't ignore. The main agent can still make changes, as a separate step, and I decide which findings deserve one.

That split was deliberate. A reviewer that fixes things as it goes also hides what it found: the problem is gone before anyone looked at it, so nobody decides whether it was really a problem, and nobody learns the pattern. A report keeps the evidence on the table.

The reviewer compares the change with the legacy version of the screen in the same branch, and it can look at other customers' versions too. When the agent migrates a screen, a narrower path-linter subagent checks the data paths first, so the bigger review doesn't spend its attention on the obvious mistakes. When I'm reviewing a screen that's already been migrated, the reviewer checks those path rules itself.

## Two things it caught

Both of these come from my own sessions in July, and both were in code the main agent had worked on.

The first was a duplicate id. The agent added ids to some hidden inputs, but an included header template already rendered inputs with exactly those ids. So the page ended up with two elements per id, and any script looking one up could get the wrong one. The diff looked fine, because the clashing ids live in a file the diff never shows. The reviewer flagged it, the main agent fixed it, and the re-review came back clean.

The second was a table built by two loops. The body loop used an index variable that only the header loop set, and the template engine evaluates that variable once. So every column in the body would have shown the value for the last column. On its own, the line looks correct: the bug only exists because of state set somewhere else and how the engine evaluates it. The reviewer caught it on a re-review after a round of fixes, and the main agent called it a bug it had missed.

## Guardrails live outside the model

Some mistakes must never happen, however good the prompt is. A rule in `CLAUDE.md` is a request. A hook is code that runs whether the model remembers the rule or not.

The first hook protects the legacy UI. It blocks edits and writes to it, including writes made through shell commands, and it checks each part of a chained command on its own. If a command touches the legacy UI and isn't on the known read-only list, it counts as a write. So the default is deny.

The second hook guards commits. Before any git or svn commit, it asks me, every time, even if I chose "always allow" earlier in the session.

## Where it went wrong, and still does

This didn't start as an agent. Before agentic coding tools were around, it was a single system instruction for a chatbot. It's been through a lot of versions since, and the loop hasn't changed: when the AI makes a mistake, I change the config to cover it. Going back through the repo's history, at least 8 of its 62 non-merge commits add a rule because the AI got something wrong.

Two of them, from the same week in May:

- Some list lookups need a flag that only exists in the new UI. The legacy-to-new mapping never shows it, so migrations kept missing it, and those lookups quietly returned truncated lists. The fix was a rule saying some new-UI attributes have no legacy counterpart and still have to be set, a warning in the reviewer, and a mandatory decision about the flag in the lookup mapping step.
- New-UI files that had been branched from another customer's copy quietly carried that customer's behaviour, and parity fixes missed it. The instructions now say to treat this branch's legacy as the source of truth, and never assume the existing new-UI file reflects it.

It still gets things wrong, and mostly on styling. The agent gets the design right a lot of the time, but there are usually a few places where it doesn't follow our design guidelines. Comparing against the legacy screen doesn't help much there, because the legacy screen is the design we're moving away from. And some screens can't be carried across as they are at all: they go back to the designer for a redesign first. That's why a quick test in the browser is part of every review, not an optional extra.

## Results

I don't have a before-and-after number. Reviews are quicker, but that's not the main change. The main change is accuracy: the setup catches the small stuff that a person reading line by line for hours is most likely to miss, like the two bugs above.

My part of the review hasn't gone away, though. I check every finding against the code before anything changes.

## Lessons learned

**Keep the reviewer separate and read-only.** Finding problems and fixing them are different jobs. Both catches above slipped past the agent that wrote the code, and a separate reviewer with its own context found them. Because it can't edit, every finding reaches a human before anything changes.

**Put the non-negotiables in hooks.** Prompts guide the model. Anything that must never happen (a write to the legacy UI, a commit nobody approved) belongs in code that runs outside it, with deny as the default.

**Load context on demand.** More instructions don't help if they're all in front of the model at once. Keep the part that always loads small, and let the agent pull in the rest when the task needs it.

**Treat every mistake as a config change.** The setup is only as good as the last mistake it was taught about. It got where it is one correction at a time, not in one design session.

But it needs something to compare against. The reviewer works here because every migrated screen has an old one to match. For a brand-new feature, or a screen the designer has redesigned, there's nothing to diff, and review goes back to judgment, mine and the team's.
