---
title: "System Design in Practice: Architecture Decisions That Scaled"
date: "2025-09-08"
excerpt: "How I architected a web platform to handle thousands of users per month. The trade-offs, mistakes, and decisions that made the difference between 'works in demo' and 'works in production.'"
tags: [system-design, architecture, scalability, backend, full-stack]
readTime: 18
---

# System Design in Practice: Architecture Decisions That Scaled

When I started building a recent full-stack project, I thought the hard part would be writing code.

I was wrong.

The hard part was deciding *how* to structure the system before writing a single line. Which database? Monolith or microservices? How to handle file uploads? Where to put business logic?

These decisions seem abstract until you're at 3 AM debugging why a background process is bringing down the database.

Here's how I designed a platform that now handles thousands of users per month, and the lessons I learned along the way.

## The Requirements

Before architecture, I needed to understand what we were actually building.

**Core functionality**:
- Users create and manage content
- File uploads (documents, images)
- Admin dashboard for reviewing submissions
- Search and filtering across records
- Email notifications at key stages

**Non-functional requirements**:
- Handle hundreds of concurrent users during peak hours
- Sub-2-second page loads
- High availability
- GDPR compliance (European users)
- Cost-effective (limited budget)

I could have started coding immediately. I've seen developers do that. It works until it doesn't.

## Decision 1: Monolith First

The microservices hype was real. Everyone was talking about breaking things into services.

I chose a monolith.

**Why**:
- Team of 2 developers. Microservices add operational overhead.
- Unclear domain boundaries. We didn't know where the natural splits were yet.
- Faster iteration. One repo, one deploy, one thing to debug.
- PostgreSQL could handle our scale for years.

**The architecture**:

```
┌─────────────────────────────────────────────┐
│              React Frontend                  │
│           (Static Hosting)                  │
└─────────────────┬───────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────┐
│              FastAPI Backend                 │
│           (Cloud Platform)                  │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Content  │ │  Users   │ │  Search  │   │
│  │  Module  │ │  Module  │ │  Module  │   │
│  └──────────┘ └──────────┘ └──────────┘   │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │     Redis    │
│   (Primary)  │    │   (Cache)    │
└──────────────┘    └──────────────┘
```

Within the monolith, I organized code into modules with clear boundaries, but deployed together.

**Trade-off acknowledged**: If we ever need to scale one part independently (like the matching algorithm), we'd need to extract it. That's a future problem. We haven't hit it yet.

## Decision 2: PostgreSQL for Everything (Almost)

I considered:
- PostgreSQL (relational, ACID, proven)
- MongoDB (document store, flexible schema)
- A combination

I chose PostgreSQL for everything.

**Why**:
- Recruitment data is highly relational (users have applications, applications belong to jobs, jobs belong to companies)
- ACID transactions matter when handling applications
- PostgreSQL's JSONB gave me flexibility where needed
- One database to manage, backup, monitor

**Schema design**:

```sql
-- Core tables (simplified)
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}'
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    metadata JSONB,  -- Flexible structure
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),

    -- Full-text search
    search_vector TSVECTOR
);

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    post_id INT REFERENCES posts(id),
    user_id INT REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    score FLOAT,
    documents JSONB,  -- References to uploaded files
    submitted_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(post_id, user_id)
);

-- Indexes that actually mattered
CREATE INDEX idx_posts_org ON posts(org_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_submissions_post ON submissions(post_id);
CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);
```

**The JSONB decision**: Some fields (like `metadata` and `documents`) use JSONB because their structure varies. Different use cases need different fields. Using JSONB avoided constant migrations while keeping querying capability.

**What I'd reconsider**: For the matching algorithm, we're doing a lot of similarity calculations. A vector database might be worth exploring as we scale. But for now, PostgreSQL handles it.

## Decision 3: File Storage Strategy

Users upload documents and images. Lots of files.

**Options considered**:
1. Store in PostgreSQL as binary
2. Store on disk on the server
3. Use cloud object storage (S3 or similar)

**Chose**: S3-compatible cloud storage

```
Upload Flow:
1. Frontend requests presigned URL from backend
2. Backend generates presigned URL with expiry
3. Frontend uploads directly to storage
4. Frontend sends file metadata to backend
5. Backend stores reference in database
```

**Why presigned URLs**:
- Files don't flow through our servers (saves bandwidth)
- Large files don't tie up API workers
- CDN handles delivery

**Code example**:

```python
import boto3
from datetime import datetime, timedelta

def get_upload_url(filename: str, content_type: str) -> dict:
    s3 = boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY
    )

    # Generate unique key
    key = f"uploads/{datetime.utcnow().strftime('%Y/%m/%d')}/{uuid4()}/{filename}"

    # Presigned URL expires in 1 hour
    url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.S3_BUCKET,
            'Key': key,
            'ContentType': content_type
        },
        ExpiresIn=3600
    )

    return {
        'upload_url': url,
        'file_key': key
    }
```

## Decision 4: Caching Strategy

Without caching, every job listing page hit the database. With 200 jobs and 500 concurrent users, that's thousands of identical queries.

**Chose**: Redis for caching, with a simple strategy.

**What I cache**:
- Content listings (changes rarely, read often)
- Public profiles
- Search results (with short TTL)
- Session data

**What I don't cache**:
- Submission status (must be real-time)
- User-specific data (too many variations)
- Anything that needs ACID guarantees

**Cache invalidation pattern**:

```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_post(post_id: int) -> dict:
    # Try cache first
    cache_key = f"post:{post_id}"
    cached = redis_client.get(cache_key)

    if cached:
        return json.loads(cached)

    # Cache miss: query database
    post = db.query("SELECT * FROM posts WHERE id = %s", [post_id])

    # Store in cache (expire in 1 hour)
    redis_client.setex(cache_key, 3600, json.dumps(post))

    return post

def update_post(post_id: int, data: dict):
    # Update database
    db.query("UPDATE posts SET ... WHERE id = %s", [post_id])

    # Invalidate cache
    redis_client.delete(f"post:{post_id}")

    # Also invalidate related caches
    redis_client.delete(f"org_posts:{data['org_id']}")
```

**Result**: Database load dropped by 70%. Average response time went from 200ms to 45ms for cached routes.

## Decision 5: Background Processing for Heavy Operations

One feature required scoring and ranking records based on multiple criteria. CPU-intensive work.

**First attempt**: Run the calculation in the API request.

```python
@app.get("/posts/{post_id}/ranked")
async def get_ranked(post_id: int):
    items = await db.fetch_all("SELECT * FROM items WHERE active = true")
    post = await db.fetch_one("SELECT * FROM posts WHERE id = $1", post_id)

    ranked = []
    for item in items:
        score = calculate_score(item, post)  # CPU-intensive
        ranked.append({'item': item, 'score': score})

    return sorted(ranked, key=lambda x: x['score'], reverse=True)[:20]
```

**Problem**: With thousands of records, this took 8 seconds. Timeout errors during peak hours.

**Solution**: Background job processing with pre-computed scores.

```
New Architecture:

┌────────────┐     ┌────────────┐     ┌────────────┐
│    API     │────▶│   Redis    │◀────│   Worker   │
│            │     │   Queue    │     │  Process   │
└────────────┘     └────────────┘     └────────────┘
                                            │
                                            ▼
                                    ┌────────────┐
                                    │ PostgreSQL │
                                    │ (scores)   │
                                    └────────────┘
```

When new content is created:
1. API enqueues "calculate scores" task
2. Worker picks up task, calculates scores for all relevant records
3. Scores stored in a dedicated table
4. API reads pre-computed scores instantly

```python
# Worker process
async def process_scoring(post_id: int):
    post = await db.fetch_one("SELECT * FROM posts WHERE id = $1", post_id)
    items = await db.fetch_all("SELECT * FROM items WHERE active = true")

    scores = []
    for item in items:
        score = calculate_score(item, post)
        scores.append((post_id, item['id'], score))

    # Batch insert scores
    await db.execute_many(
        "INSERT INTO computed_scores (post_id, item_id, score) VALUES ($1, $2, $3)",
        scores
    )
```

**Result**: API response time went from 8 seconds to 50ms. Heavy computation runs in the background, users see instant results.

## Decision 6: API Design

RESTful API with a few pragmatic exceptions.

**Standard REST endpoints**:
```
GET    /api/posts              # List posts
POST   /api/posts              # Create post
GET    /api/posts/{id}         # Get post
PUT    /api/posts/{id}         # Update post
DELETE /api/posts/{id}         # Delete post

GET    /api/posts/{id}/submissions    # List submissions
POST   /api/posts/{id}/submissions    # Create submission
```

**Pragmatic exceptions**:

1. **Batch operations**: Creating many records one at a time is slow.
   ```
   POST /api/posts/batch
   Body: [{ post1 }, { post2 }, ...]
   ```

2. **Complex queries**: Some queries don't fit REST cleanly.
   ```
   POST /api/search
   Body: { filters: [...], sort: {...}, pagination: {...} }
   ```

3. **Actions that aren't CRUD**:
   ```
   POST /api/submissions/{id}/approve
   POST /api/submissions/{id}/reject
   ```

**Versioning**: All endpoints prefixed with `/api/v1/`. Haven't needed v2 yet, but it's there when we do.

## The Mistakes I Made

### Mistake 1: No Rate Limiting Initially

The API got hit hard by automated requests. Database performance suffered.

**Fix**: Added rate limiting at the API level.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/posts")
@limiter.limit("100/minute")
async def list_posts():
    # ...
```

### Mistake 2: N+1 Queries Everywhere

My first version had classic N+1 problems:

```python
# Bad: N+1 query
posts = await db.fetch_all("SELECT * FROM posts")
for post in posts:
    post['org'] = await db.fetch_one(
        "SELECT * FROM organizations WHERE id = $1",
        post['org_id']
    )
```

50 posts = 51 database queries. Slow.

**Fix**: Eager loading with JOINs.

```python
# Good: Single query
posts = await db.fetch_all("""
    SELECT p.*, o.name as org_name, o.logo as org_logo
    FROM posts p
    JOIN organizations o ON p.org_id = o.id
    WHERE p.status = 'active'
""")
```

### Mistake 3: Synchronous Email Sending

Early on, I sent emails synchronously in API requests.

```python
@app.post("/api/submissions")
async def create_submission(data: dict):
    submission = await save_submission(data)

    # This takes 2-3 seconds
    send_confirmation_email(data['email'])
    send_notification_to_admin(submission['id'])

    return submission
```

Users waited 3+ seconds for their submission to complete.

**Fix**: Queue emails for background processing.

```python
@app.post("/api/submissions")
async def create_submission(data: dict):
    submission = await save_submission(data)

    # Queue emails (instant)
    await queue.enqueue('send_email', {
        'type': 'submission_confirmation',
        'to': data['email'],
        'submission_id': submission['id']
    })

    return submission  # Returns immediately
```

## What I'd Do Differently

**Start with better observability**: I added logging and monitoring after problems occurred. Should have done it from day one. Now I use structured logging and Sentry from the start.

**Design for multi-tenancy earlier**: Adding proper data isolation between companies was painful to retrofit. Should have planned for it initially.

**Write architecture decision records**: I made decisions in my head. When a new developer joined, I had to explain everything verbally. Now I document major decisions in ADRs.

## The Results

After running in production:

- Thousands of users per month
- High uptime (one incident early on, database connection pool exhaustion)
- Average API response time: 85ms
- No security incidents
- Reasonable hosting costs

The monolith is still a monolith. It still fits the needs. When it doesn't, I'll split it. But not before.

## Key Takeaways

**Start simple, add complexity when needed**. Every architectural decision should solve a current problem, not a hypothetical future one.

**Understand your data access patterns**. Most of my optimizations came from understanding which queries ran most often and optimizing those.

**Background jobs are your friend**. Anything that doesn't need to happen synchronously shouldn't. Users don't want to wait.

**Cache aggressively, invalidate carefully**. Caching is easy. Knowing when to invalidate is hard. Design your invalidation strategy before you cache.

**Measure before you optimize**. I wasted time optimizing things that weren't slow. Now I profile first, optimize second.

System design isn't about getting everything right upfront. It's about making decisions you can live with and change later when you understand the problem better.

Build for today. Design for tomorrow. Refactor when yesterday's decisions become today's problems.
