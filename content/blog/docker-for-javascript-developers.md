---
title: "Docker for JavaScript Developers: A Practical Introduction"
date: "2025-06-10"
excerpt: "'Works on my machine' stopped being acceptable when deploying to production. Docker saved me from environment hell and made our deployments predictable."
tags: [docker, nodejs, deployment, devops, containers]
readTime: 16
---

# Docker for JavaScript Developers: A Practical Introduction

"It works on my machine."

I said this so many times that my team lead finally snapped: "Then we'll ship your machine."

Spoiler: We didn't ship my machine. We learned Docker.

Here's why Docker matters, even if you're "just a JavaScript developer."

## The Problem: Environment Hell

I had a Node.js app that worked perfectly locally:
- Node.js v18.12.0
- PostgreSQL 14
- Redis for caching
- Specific environment variables

Then I deployed to staging.

Nothing worked.

**Why**:
- Staging server had Node.js v16.14.0
- PostgreSQL was version 13
- Redis wasn't installed
- Environment variables were different

I spent 6 hours debugging. The bug? A Node.js version difference broke a dependency. Six hours.

**Docker solves this**: Your app runs in the same environment everywhere. No surprises.

## What is Docker? (Without the Jargon)

Docker is a way to package your app with everything it needs:
- Your code
- Node.js runtime
- Dependencies (npm packages)
- System libraries
- Environment configuration

This package (called a "container") runs the same on your laptop, your coworker's laptop, staging, and production.

**Think of it like this**:
- **Without Docker**: "Here's my code. Install Node.js v18, PostgreSQL 14, Redis, set these env vars, then run `npm start`. Good luck."
- **With Docker**: "Run this container. Everything is already configured."

## My First Dockerfile (And What I Learned)

I'll show you the wrong way first (because that's how I learned).

### Version 1: The Naive Approach

```dockerfile
FROM node:18

# Copy everything
COPY . /app

# Set working directory
WORKDIR /app

# Install dependencies
RUN npm install

# Run the app
CMD ["npm", "start"]
```

**Run it**:
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

This worked! But it was slow. Every time I changed one line of code, Docker reinstalled ALL dependencies. Build time: **3 minutes**.

### Version 2: Layer Caching (The Fix)

Docker builds in layers. If a layer hasn't changed, Docker reuses the cached version.

```dockerfile
FROM node:18

WORKDIR /app

# Copy package files FIRST
COPY package*.json ./

# Install dependencies (cached if package.json unchanged)
RUN npm install

# Copy the rest of the code
COPY . .

# Run the app
CMD ["npm", "start"]
```

Now if I only change code (not package.json), Docker reuses the `npm install` layer.

**Build time**: 5 seconds (instead of 3 minutes).

**Lesson**: Order matters in Dockerfiles. Copy the things that change least first.

### Version 3: Production Optimizations

By this point I'd learned a few things from production deployments. Here's what a real production Dockerfile looks like:

```dockerfile
FROM node:18-alpine  # Smaller image (alpine is minimal Linux)

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production  # 'npm ci' is faster and more reliable than 'npm install'

# Copy application code
COPY . .

# Don't run as root (security)
USER node

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error()})"

CMD ["node", "server.js"]
```

**What changed**:
- `node:18-alpine` - 200MB smaller than `node:18`
- `npm ci --only=production` - Faster, skips dev dependencies
- `USER node` - Security best practice (don't run as root)
- Health check - Docker can detect if the app crashes

**Image size**: 500MB → 150MB

Worth it.

## Docker Compose: Multi-Container Apps

My app needed Node.js, PostgreSQL, and Redis. Running them separately was annoying.

**Docker Compose** lets you define all containers in one file:

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Node.js app
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  # PostgreSQL
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis
  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

**Start everything**:
```bash
docker-compose up
```

One command. App, database, cache all running.

**Stop everything**:
```bash
docker-compose down
```

No more "did you start Redis?" or "what's the database password?"

## Real Use Cases from My Projects

### Use Case 1: Onboarding New Developers

**Before Docker**:
```
1. Install Node.js v18.12.0
2. Install PostgreSQL 14
3. Install Redis
4. Clone the repo
5. Copy .env.example to .env
6. Edit .env with local database credentials
7. Run migrations
8. Install dependencies
9. Pray it works
```

New developers took half a day to get set up. Sometimes a full day if they hit issues.

**With Docker**:
```bash
git clone [repo]
docker-compose up
```

Setup time: **2 minutes**. Works on Mac, Windows, Linux.

### Use Case 2: Testing Different Node.js Versions

We needed to support Node.js 16, 18, and 20. Testing locally meant switching Node versions constantly (using nvm or similar).

**With Docker**:
```bash
# Test on Node 16
docker run -v $(pwd):/app -w /app node:16 npm test

# Test on Node 18
docker run -v $(pwd):/app -w /app node:18 npm test

# Test on Node 20
docker run -v $(pwd):/app -w /app node:20 npm test
```

No switching. Run tests on all versions in parallel in CI/CD.

### Use Case 3: Consistent Deployments

We deployed to three environments: staging, production, and a client demo server.

Each had different versions of system libraries, which caused weird bugs.

**With Docker**: The SAME container image runs in all environments. If it works in staging, it works in production.

```bash
# Build once
docker build -t myapp:1.2.3 .

# Push to registry
docker push myregistry.com/myapp:1.2.3

# Deploy to staging
ssh staging "docker pull myregistry.com/myapp:1.2.3 && docker run -d myapp:1.2.3"

# Deploy to production (same image)
ssh production "docker pull myregistry.com/myapp:1.2.3 && docker run -d myapp:1.2.3"
```

## Common Gotchas I Ran Into

### 1. Volumes for Hot Reload

During development, I wanted hot reload (code changes reload the app automatically).

**Problem**: Code is copied INTO the container at build time. Changing code locally doesn't affect the container.

**Solution**: Mount your code as a volume:

```yaml
services:
  app:
    build: .
    volumes:
      - .:/app  # Mount current directory into /app
      - /app/node_modules  # Don't overwrite node_modules
    command: npm run dev  # Run in dev mode with hot reload
```

Now changes to local files instantly update in the container.

### 2. Database Persistence

I ran `docker-compose down` and lost all my database data.

All of it. Three days of test data, gone.

**Problem**: Container data is ephemeral (deleted when container stops).

**Solution**: Use volumes for persistent data:

```yaml
services:
  db:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Persists data

volumes:
  postgres_data:  # Named volume (managed by Docker)
```

Now data survives container restarts.

### 3. .dockerignore File

My Docker build copied `node_modules` (30,000 files) into the container, then `npm install` reinstalled them.

**Solution**: Add `.dockerignore`:

```
node_modules
npm-debug.log
.git
.env
dist
coverage
```

Like `.gitignore`, but for Docker. Build time dropped from 2 minutes to 10 seconds.

### 4. Port Conflicts

I tried to run two projects simultaneously. Both used port 3000. Docker said "port already in use."

**Solution**: Map to different host ports:

```yaml
# Project 1
services:
  app:
    ports:
      - "3000:3000"

# Project 2
services:
  app:
    ports:
      - "3001:3000"  # Host port 3001 -> container port 3000
```

Project 1 at `localhost:3000`, Project 2 at `localhost:3001`.

## Docker Commands I Use Daily

### Building and Running

```bash
# Build an image
docker build -t my-app .

# Run a container
docker run -p 3000:3000 my-app

# Run in detached mode (background)
docker run -d -p 3000:3000 my-app

# Run with environment variables
docker run -e NODE_ENV=production -p 3000:3000 my-app
```

### Managing Containers

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop a container
docker stop <container_id>

# Remove a container
docker rm <container_id>

# View logs
docker logs <container_id>

# Follow logs in real-time
docker logs -f <container_id>
```

### Docker Compose

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs

# Rebuild images
docker-compose up --build
```

### Debugging

```bash
# Execute command in running container
docker exec -it <container_id> bash

# Inspect container details
docker inspect <container_id>

# View resource usage
docker stats
```

## What I Learned (And What Changed)

**Before Docker**:
- "Works on my machine" was a meme AND a real problem
- New developers took hours to set up
- Deployments were stressful (will it work in production?)
- Different environments had different bugs

**After Docker**:
- Onboarding: 2 minutes
- Deployments: predictable (same container everywhere)
- Development environment matches production
- Testing on multiple Node versions: trivial

**Metrics**:
- **Developer onboarding time**: 4 hours → 2 minutes
- **Deployment bugs from environment differences**: ~40% reduction
- **Time spent debugging "works on my machine"**: Near zero

## My Docker Workflow Today

### Development

```bash
# Start the app with hot reload
docker-compose up

# Run tests in a container
docker-compose run app npm test

# Access database directly
docker-compose exec db psql -U postgres -d myapp
```

### CI/CD (GitHub Actions)

```yaml
name: CI

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker image
        run: docker build -t my-app .
      - name: Run tests
        run: docker run my-app npm test
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag my-app myregistry.com/my-app:${{ github.sha }}
          docker push myregistry.com/my-app:${{ github.sha }}
```

Same Docker image built in CI, tested, then deployed.

### Production Deployment

```bash
# Pull the tested image
docker pull myregistry.com/my-app:abc123

# Run it
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=$DATABASE_URL \
  --name my-app \
  myregistry.com/my-app:abc123
```

Or use Docker Swarm / Kubernetes for orchestration (but that's another article).

## Common Mistakes I Made

### 1. Running Everything in Docker Locally

I tried to run my code editor, Git, everything in Docker. It was slow and painful.

Don't be like me.

**Lesson**: Docker is for running your app and its dependencies, not your entire dev environment. Keep your editor and Git on your host machine.

### 2. Not Using Multi-Stage Builds

My production image included dev dependencies, source TypeScript files, etc. Image size: 800MB.

**Fix**: Multi-stage builds

```dockerfile
# Stage 1: Build
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
CMD ["node", "dist/server.js"]
```

Image size: 800MB → 180MB.

### 3. Hardcoding Secrets in Dockerfiles

I did this:
```dockerfile
ENV DATABASE_PASSWORD=supersecret123
```

**NEVER DO THIS**. Secrets in Docker images can be extracted by anyone with access to the image.

**Fix**: Pass secrets at runtime:
```bash
docker run -e DATABASE_PASSWORD=$DATABASE_PASSWORD my-app
```

## When NOT to Use Docker

Docker isn't always the answer.

**Simple static sites**: Just deploy the HTML/CSS/JS. No need for containers.

**Serverless functions**: AWS Lambda, Netlify Functions already handle runtime environments.

**Extremely resource-constrained environments**: Docker has overhead.

But for most Node.js apps? Docker is worth it.

## If I Could Start Over

I'd learn Docker in my first month of web development, not after two years of "works on my machine" pain.

Seriously, if someone told me "spend a week learning Docker now, save 100+ hours of debugging later," I'd have done it immediately.

**Week 1 curriculum**:
1. Run a simple Node app in Docker
2. Add PostgreSQL with Docker Compose
3. Use volumes for hot reload
4. Write a production-ready Dockerfile
5. Set up CI/CD with Docker

These aren't advanced topics. They're fundamentals for modern web development.

And you can learn them in a week.

## Your Turn: Dockerize Your App

Take your current Node.js project and try this:

### Day 1: Basic Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
```

Build it:
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Day 2: Add docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
```

Run it:
```bash
docker-compose up
```

### Day 3: Add Your Database

```yaml
services:
  app:
    # ... existing config
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/mydb
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

That's it. You're using Docker.

## Resources That Helped Me

- [Docker's Official Node.js Guide](https://docs.docker.com/language/nodejs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/dev-best-practices/)

But honestly? Just start using it. The learning curve is manageable, and the payoff is significant.

Docker has become an essential part of my development workflow. The consistency it provides, from local development to production, eliminates an entire category of bugs and frustrations. It's one of those investments that keeps paying dividends on every project.

