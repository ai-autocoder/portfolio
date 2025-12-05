---
title: "CI/CD Pipeline Setup: GitHub Actions for Full Stack Apps"
date: "2025-10-03"
excerpt: "Build a robust CI/CD pipeline with GitHub Actions that runs tests, builds your app, and deploys automatically. No more manual deployments or Friday stress."
tags: [cicd, github-actions, devops, automation, deployment]
readTime: 8
---

# CI/CD Pipeline Setup: GitHub Actions for Full Stack Apps

I used to deploy manually. SSH into the server, git pull, restart the service, hope nothing broke. Every deploy was stressful.

Now I push to GitHub and 2 minutes later it's deployed. Tests run automatically. If something fails, the deploy stops. It's boring, in the best way.

Here's how to set up a CI/CD pipeline that actually works, based on what I've learned from dozens of projects.

## Why CI/CD Matters (The Real Reasons)

The textbook answer: "Faster deployments, fewer bugs, better collaboration."

The real answer: **I was tired of breaking production on Friday evenings.**

With CI/CD:
- Tests run before deploy (so I catch bugs before users do)
- Deploy process is consistent (no more "did I remember to restart the service?")
- I can deploy from my phone if needed (not that I should, but I can)
- Rollbacks are one button click

That Friday evening peace of mind is worth the setup time.

## Example Project Setup

Full stack app:
- **Frontend**: Next.js + React
- **Backend**: Netlify Functions (Node.js)
- **Deployment**: Netlify (frontend + functions)
- **Source Control**: GitHub

Every push to `main` should:
1. Run tests
2. Build the app
3. Deploy to production
4. Notify if anything fails

Let's build it.

## Step 1: The Basic Workflow

GitHub Actions uses YAML files in `.github/workflows/`. Here's the simplest version:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Netlify
        run: npx netlify deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

This works, but it's basic. Let's make it better.

## Step 2: Add Linting and Type Checking

Tests aren't enough. I also want to catch:
- Linting errors (formatting, code quality)
- Type errors (TypeScript)
- Security issues

```yaml
jobs:
  quality-checks:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'  # Cache npm packages for speed

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json
```

Now every push runs all quality checks. If any fail, I get notified immediately.

## Step 3: Separate Environments (Staging vs Production)

I don't want every commit to go straight to production. I want:
- **Pull requests** → Deploy to preview environment
- **Merging to main** → Deploy to production

```yaml
name: Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy-preview:
    runs-on: ubuntu-latest
    needs: test  # Only deploy if tests pass
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build

      - name: Deploy to Netlify Preview
        run: |
          npx netlify deploy --alias pr-${{ github.event.pull_request.number }}
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build

      - name: Deploy to Netlify Production
        run: npx netlify deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

Now:
- PRs get a preview URL (like `pr-42--myapp.netlify.app`)
- Merging to main deploys to production

## Step 4: Add Environment Variables

Never, ever commit API keys or secrets. Use GitHub Secrets:

1. Go to your repo → Settings → Secrets and variables → Actions
2. Add secrets:
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`
   - `DATABASE_URL` (if needed)
   - etc.

Then use them in your workflow:

```yaml
- name: Deploy
  env:
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
  run: npm run deploy
```

These are encrypted and never exposed in logs.

## Step 5: Matrix Testing (Multiple Node Versions)

Want to test on multiple Node versions? Easy:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16, 18, 20]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

This runs tests on Node 16, 18, and 20 in parallel.

Useful if you're building a library. For apps, testing on one version is usually enough.

## Step 6: Caching for Speed

Without caching, every run installs all dependencies from scratch. With caching:

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/setup-node@v3
    with:
      node-version: '18'
      cache: 'npm'  # This caches node_modules

  - run: npm ci
```

First run: 90 seconds to install dependencies.
Subsequent runs: 15 seconds.

Huge time saver.

## Step 7: Conditional Steps

Sometimes you only want certain steps to run in specific situations:

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deploy failed!'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

- name: Only run on main branch
  if: github.ref == 'refs/heads/main'
  run: npm run production-only-task
```

Conditionals I use often:
- `if: success()` - Only if previous steps succeeded
- `if: failure()` - Only if previous steps failed
- `if: always()` - Always run (useful for cleanup)
- `if: github.ref == 'refs/heads/main'` - Only on main branch

## Step 8: Scheduled Workflows (Cron Jobs)

Need to run something daily? Use `schedule`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Every day at 2 AM UTC

jobs:
  nightly-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
```

I use this for:
- Nightly dependency updates
- Running long integration tests
- Generating reports

## The Complete Example

Here's a complete workflow example for a full-stack app:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'

jobs:
  quality:
    name: Quality Checks
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: success()

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: .next

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build
          path: .next

      - name: Deploy to Netlify Preview
        id: netlify-deploy
        run: |
          netlify deploy \
            --alias pr-${{ github.event.pull_request.number }} \
            --json > deploy-output.json
          echo "url=$(cat deploy-output.json | jq -r '.deploy_url')" >> $GITHUB_OUTPUT
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Comment preview URL on PR
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed to: ${{ steps.netlify-deploy.outputs.url }}'
            })

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build
          path: .next

      - name: Deploy to Netlify Production
        run: netlify deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Notify deployment
        if: success()
        run: echo "🎉 Deployed to production!"
```

This workflow:
- ✅ Runs linting, type checking, and tests
- ✅ Builds the application
- ✅ Deploys PRs to preview URLs
- ✅ Deploys to production on merge to main
- ✅ Comments the preview URL on PRs
- ✅ Uses caching for speed
- ✅ Only deploys if tests pass

## Common Mistakes (That I Made)

### Mistake #1: Not Failing Fast

My early workflows ran all steps even if one failed. So I'd wait 10 minutes only to find out the tests failed at minute 1.

**Fix**: Workflows fail by default if any step fails. Don't change this.

### Mistake #2: Rebuilding in Every Job

I was running `npm ci && npm run build` in every job. Wasteful.

**Fix**: Build once, upload as artifact, download in other jobs.

### Mistake #3: Committing Secrets

I'm embarrassed to admit this, but I once committed `secrets.env` with API keys.

**Fix**: Always use GitHub Secrets. Add `*.env` to `.gitignore`.

### Mistake #4: No Rollback Plan

Deploy broke production. Took me 20 minutes to figure out how to revert.

**Fix**: Know how to rollback before you need to. For Netlify, it's just clicking "Restore" on an old deploy.

## Monitoring and Notifications

I set up Slack notifications for deploy status:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: |
      Deploy ${{ job.status }}
      Commit: ${{ github.event.head_commit.message }}
      Author: ${{ github.actor }}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

Now I get notified on every deploy (success or failure).

For personal projects, email works fine too:

```yaml
- name: Send email on failure
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: Deploy failed for ${{ github.repository }}
    body: Check GitHub Actions for details
    to: your-email@example.com
    from: GitHub Actions
```

## The Results

Since setting up CI/CD:
- **300+ successful deploys** (zero broken production deploys)
- **Average deploy time**: 2 minutes from push to live
- **Peace of mind**: Deploys are boring (which is perfect)

## Your Turn: Set It Up Today

```bash
# 1. Create the workflow file
mkdir -p .github/workflows
touch .github/workflows/deploy.yml

# 2. Add the workflow (use the examples above)
# 3. Add secrets to GitHub (Settings → Secrets)
# 4. Push to GitHub
# 5. Watch the magic happen
```

Start simple. You can always add more later.

The basic workflow (lint → test → build → deploy) takes 30 minutes to set up and will save you hours every week.

CI/CD isn't just about automation. It's about building confidence. Every project I work on now gets a proper pipeline from day one. It's become one of those non-negotiable practices that consistently delivers value.

