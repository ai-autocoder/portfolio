---
title: "From Internal Tool to Public Extension: Multi-Projects Diff"
date: "2025-03-10"
excerpt: "How a weekend project solving my workflow problem became a VS Code extension on two marketplaces, and the lessons learned from shipping a production tool."
tags: [vscode, extension, typescript, open-source, developer-tools]
readTime: 13
---

# From Internal Tool to Public Extension: My Multi-Projects Diff Journey

The Multi-Projects Diff extension started as a hacky script to solve a problem nobody else seemed to have. Two years later, it's published on the VS Code Marketplace and actually helping people. Here's how that happened.

## The Problem: Managing Multiple Similar Projects

I once worked on a project where the same codebase was deployed for multiple clients, each with their own customizations. Essentially, we maintained 8 slightly different versions of the same codebase.

This approach made sense for the business model, each client needed specific features and branding but it created an interesting technical challenge.

The biggest challenge was keeping features in sync. We'd add a feature to one version, and then needed to manually port it to the others. Except each version had different customizations, so you couldn't just copy-paste. You had to:

1. Open Project A
2. Find the changed files
3. Open Project B
4. Find the corresponding files
5. Manually compare and merge changes
6. Repeat for all other projects

This took HOURS. And we did it weekly.

## The First Attempt: A Bash Script

My first solution was a bash script that used `diff`:

```bash
#!/bin/bash
# Compare the same file across different project versions
diff ~/projects/project-a/src/components/Header.js ~/projects/project-b/src/components/Header.js
```

This worked for one file at a time. But I'd have to run it for every file I changed, remember the paths, and manually open files in VS Code to see the differences.

I wanted something better - something that could show me how a file differs across ALL project versions at once, right in my editor.

## The Internal Tool: A Quick VS Code Extension

I'd never built a VS Code extension before, but I figured "how hard could it be?" (Narrator: It was harder than he thought.)

### Learning the VS Code API

The VS Code extension docs are... fine. But they assume you know what you're looking for. I didn't.

I started with their "Hello World" example and just started experimenting. Here's what I learned:

**1. Extensions are just Node.js with extra APIs**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World!');
    });

    context.subscriptions.push(disposable);
}
```

That's it. You're just registering commands and calling VS Code's API.

**2. The real power is in the API**

VS Code lets you:
- Read and write files
- Show custom UI (webviews, tree views, input boxes)
- Run commands
- Listen to file changes
- Basically do anything VS Code itself can do

### Building the File Comparison Tool

My first version was embarrassingly simple:

```typescript
// Get the currently open file
const currentFile = vscode.window.activeTextEditor?.document.fileName;
const relativePath = path.relative(projectA, currentFile);

// Find the same file in other projects
const projectBFile = path.join(projectB, relativePath);
const projectCFile = path.join(projectC, relativePath);

// Compare content
const currentContent = fs.readFileSync(currentFile, 'utf8');
const projectBContent = fs.existsSync(projectBFile)
    ? fs.readFileSync(projectBFile, 'utf8')
    : null;

// Show basic diff
if (currentContent !== projectBContent) {
    console.log(`File differs in Project B`);
}
```

It worked! Kind of. It only compared two projects at a time, and I had to manually check the console output. Not great.

But it saved me 30 minutes every week, so I kept using it.

## The Turning Point: Other Developers Wanted It

One day, a colleague saw me using it and asked "What's that?" I explained, and he said "Can I have that?"

That's when I realized: maybe this isn't just my weird problem. Maybe others deal with multi-repo projects too.

So I spent a weekend making it less embarrassing:

1. **Made the comparison paths configurable** (settings.json instead of hardcoded paths)
2. **Added a proper UI panel** (Activity Bar view showing all projects)
3. **Showed diff statistics** (lines added/removed for each project)
4. **Made it compare multiple projects at once** (not just two)
5. **Wrote a README** (copy-pasted from another extension, tbh)

## Publishing to the Marketplace

Publishing a VS Code extension is surprisingly easy. Too easy, maybe. Here's the process:

### 1. Create a Publisher Account

Go to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/), create a publisher account. Takes 5 minutes.

### 2. Package Your Extension

```bash
npm install -g vsce
vsce package
```

This creates a `.vsix` file. That's your extension.

### 3. Publish It

```bash
vsce publish
```

Done. Your extension is now on the Marketplace.

I did this on a Saturday afternoon, honestly not expecting anyone to use it.

Here's how simple the configuration ended up being:

```json
{
  "multiProjectsDiff.diffGroups": [
    {
      "name": "Client Projects",
      "ignoreWhiteSpace": false,
      "workspaces": [
        {
          "name": "Client A",
          "path": "/Users/me/projects/client-a"
        },
        {
          "name": "Client B",
          "path": "/Users/me/projects/client-b"
        },
        {
          "name": "Client C",
          "path": "/Users/me/projects/client-c"
        }
      ]
    }
  ]
}
```

Open a file in Client A, and the extension shows you exactly how it differs in Client B and C. Lines added, lines removed, right there in the sidebar.

## The Surprise: People Actually Used It

The reception surprised me. Within the first week, developers started finding it. Over time, it's been downloaded 350+ times across VS Code Marketplace and OpenVSX - modest numbers, but meaningful because these are developers actively searching for multi-project comparison tools.

What made it real was the variety of use cases:
- Teams managing client-specific codebases (like my original problem)
- Developers working with monorepo setups
- Engineers maintaining multiple deployment environments

### What I Actually Learned

**1. Published = Real Constraints**

Building for myself meant I could hard-code paths and skip error handling. Publishing meant:
- Proper configuration schema (settings.json)
- Error handling for edge cases I never encountered
- Documentation for people who don't think like me
- Testing on different OSes

**2. The Gap Between "Works" and "Production-Ready"**

My internal version was 200 lines of TypeScript. The published version was 1,000+ lines because production means:
- Input validation
- Configuration migration handling
- Performance optimization (worker threads)
- Proper logging and error messages
- Comprehensive README with examples

**3. Nobody Discovers Small Extensions Organically**

With 350+ downloads and zero marketing, I learned that discoverability is a real product challenge. The Marketplace has 40,000+ extensions. Even solving a real problem doesn't mean people will find you.

But those 350+ downloads? They're all from developers actively searching for "multi-project diff" or "compare across repos." That means the people using it really needed it.

**Features people loved:**
- **Watch Mode**: Automatically updates comparison when switching files (eye icon toggle)
- **One-click actions**: Open diff view, push changes, create missing files
- **Pin reference file**: Set which project version to compare against
- **Performance**: Fast diffing even with large files across many projects (worker threads)
- **Zero telemetry**: All local, no tracking, no network requests

**Features I considered but skipped:**
- Advanced filtering options (added complexity without clear benefit)
- Custom color themes (nice to have, not essential)
- Export to PDF (seriously, who asked for this?)

I learned to let the users guide the roadmap. The telemetry thing? Users specifically asked for a guarantee that nothing leaves their machine. Privacy matters.

## The Technical Evolution

### Version 1.0: Basic File Check

```typescript
// Simple existence check
const currentFile = getCurrentFile();
const projectPaths = getConfiguredProjects();

projectPaths.forEach(projectPath => {
    const targetFile = path.join(projectPath, relativePath);
    if (!fs.existsSync(targetFile)) {
        console.log(`File missing in ${projectPath}`);
    }
});
```

### Version 2.0: Content Comparison

```typescript
// Compare file contents
const referenceContent = fs.readFileSync(referenceFile, 'utf8');

const results = projectPaths.map(projectPath => {
    const targetFile = path.join(projectPath, relativePath);
    const targetContent = fs.readFileSync(targetFile, 'utf8');

    const diff = diffLines(referenceContent, targetContent);
    const added = diff.filter(d => d.added).length;
    const removed = diff.filter(d => d.removed).length;

    return { projectPath, added, removed };
});
```

### Version 3.0: Parallelized with Worker Threads

This was the game-changer. For large files across many projects, diff calculation was blocking the UI.

```typescript
import { Worker } from 'worker_threads';

// Offload diff calculation to worker threads
async function compareFilesInParallel(referenceFile: string, projects: Project[]) {
    const workers = projects.map(project => {
        return new Promise((resolve) => {
            const worker = new Worker('./diff-worker.js', {
                workerData: { referenceFile, projectPath: project.path }
            });

            worker.on('message', (result) => {
                resolve({ project: project.name, ...result });
            });
        });
    });

    return Promise.all(workers);
}
```

Result: **3-4x faster** diffing on medium/large files. UI stays responsive even when comparing across 8+ projects.

## The Unexpected Benefits

Building this extension taught me more than I expected:

### 1. Better Understanding of VS Code

I use VS Code every day, but building an extension made me understand how it actually works. Now I'm more productive because I know what's possible.

### 2. TypeScript Skills

The VS Code API is TypeScript-first. I had to learn proper TypeScript, not just "JavaScript with types sprinkled in."

### 3. Product Thinking

This wasn't just code anymore. I had to think about:
- **User experience**: How do users know which file is the "reference"? Added pin icons.
- **Documentation**: Clear README with GIFs showing features in action helps users understand quickly.
- **Configuration**: Making settings discoverable and well-documented.
- **Versioning**: Understanding semantic versioning and maintaining backwards compatibility.
- **Privacy**: Developers care about their code staying on their machine. Zero telemetry became a feature.

These are skills that transfer to any project.

## The Mistakes I Made

### 1. No Tests Initially

The first version had zero tests. Adding them later was painful. Now I write tests first.

### 2. Poor Version Control

I published several versions with breaking bugs because I didn't test thoroughly. Now I have a release checklist.

### 3. No Telemetry (By Design)

I made a conscious decision: **zero telemetry**. The extension operates entirely locally. No network requests, no usage tracking, nothing leaves your machine.

This means I have no idea how people actually use it. Would analytics help me build better features? Yes. But trust and privacy matter more, especially for developer tools that work with potentially sensitive codebases.

### 4. Tried to Please Everyone

I added features that 1 person requested and other people found confusing. Now I wait to see if multiple people want something before building it.

## Would I Do It Again?

Absolutely. Building this extension:
- Solved a real problem for me
- Helped other developers
- Taught me a ton
- Looks great on my resume

If you have a problem that a tool could solve, build the tool. Even if it's just for you. You might be surprised who else needs it.

## Your Turn: Build Your Own Extension

If you're thinking about building a VS Code extension, here's my advice:

### Week 1: Learn the Basics
- Read the [official docs](https://code.visualstudio.com/api)
- Clone the Hello World example
- Make it do something useful for you

### Week 2: Build a Simple Version
- Don't overthink it
- Solve your specific problem first
- Ugly UI is fine

### Week 3: Polish and Publish
- Add a README with screenshots
- Test it thoroughly
- Publish to Marketplace

### Month 2+: Iterate Based on Feedback
- Fix bugs quickly
- Add features slowly
- Listen to users

The bar is lower than you think. Your janky script that solves a real problem is better than a perfectly polished tool nobody needs.

## Try It Yourself

Multi-Projects Diff is still evolving. Recent improvements include:
- **Worker thread parallelization** for 3-4x faster diffing
- **Watch Mode** that auto-updates when switching files
- **One-click actions** to push changes or create missing files
- **Group selection** for comparing against different project sets
- **Zero telemetry** - everything stays local

The core problem it solves: **comparing how a single file differs across multiple project versions**.

The use case that started it all - maintaining 8 versions of the same codebase for different clients - is exactly what this extension excels at.

If you're dealing with multi-repo setups where you maintain similar codebases for different clients or environments, give it a try. It's on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-autocoder.multi-project-diff).

And if you find bugs or have feature ideas, the project is open source on [GitHub](https://github.com/ai-autocoder/multi-project-diff).

Building this extension taught me that the best developer tools come from real pain points, not theoretical ideas. It's now one of my favorite projects. Something that started as a weekend hack and grew into a tool that genuinely helps people.

