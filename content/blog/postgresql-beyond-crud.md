---
title: "PostgreSQL for Full Stack Developers: Beyond Basic CRUD"
date: "2025-04-15"
excerpt: "PostgreSQL is more than just INSERT, UPDATE, DELETE. Here's what changed when I stopped treating it like a dumb data store and unlocked its real power."
tags: [postgresql, database, sql, backend, performance]
readTime: 14
---

# PostgreSQL for Full Stack Developers: Beyond Basic CRUD

For the first two years of my career, I treated PostgreSQL like a glorified spreadsheet. INSERT data, SELECT it back, maybe UPDATE or DELETE sometimes. Job done, right?

Wrong.

Then I joined a project where the database was doing actual work. Complex queries, aggregations, transactions that actually mattered. And I realized I'd been using maybe 10% of what PostgreSQL could do.

Here's what I wish someone had told me earlier.

## The Problem: When Basic CRUD Breaks Down

I was building a recruitment platform (CargoCrew) where companies could post job listings and candidates could apply. Simple enough:

```sql
-- Jobs table
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    company_id INT,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Applications table
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    job_id INT,
    candidate_id INT,
    status VARCHAR(50),
    applied_at TIMESTAMP DEFAULT NOW()
);
```

Basic CRUD worked fine until the product manager asked: "Can we show how many applications each job has received in the last 30 days?"

My first instinct? Fetch all jobs, loop through them in JavaScript, count applications for each one. Classic.

```javascript
// The slow way
const jobs = await db.query('SELECT * FROM jobs');

for (let job of jobs) {
    const applications = await db.query(
        'SELECT COUNT(*) FROM applications WHERE job_id = $1 AND applied_at > NOW() - INTERVAL \'30 days\'',
        [job.id]
    );
    job.applicationCount = applications.rows[0].count;
}
```

This worked. For 10 jobs.

But we had 500+ active jobs. Each page load took **4-5 seconds**. Recruiters complained. The CEO complained. I complained.

That's when I learned my first lesson: **let the database do the work**.

## Lesson 1: JOINs and Aggregations Are Your Friends

Instead of N+1 queries in JavaScript, do it in one SQL query:

```sql
SELECT
    j.id,
    j.title,
    j.company_id,
    COUNT(a.id) as application_count
FROM jobs j
LEFT JOIN applications a ON a.job_id = j.id
    AND a.applied_at > NOW() - INTERVAL '30 days'
WHERE j.status = 'active'
GROUP BY j.id, j.title, j.company_id
ORDER BY j.created_at DESC
LIMIT 50;
```

**Result**: Page load time went from 4-5 seconds to **180ms**. Same data, same result, 25x faster.

The database is optimized for this. JavaScript isn't. I should've known that.

## Lesson 2: Indexes Make or Break Performance

The above query was fast. Until we had 50,000 jobs and 200,000 applications. Then it was slow again.

I ran `EXPLAIN ANALYZE` (PostgreSQL's query planner) to see what was going on:

```sql
EXPLAIN ANALYZE
SELECT j.id, j.title, COUNT(a.id) as application_count
FROM jobs j
LEFT JOIN applications a ON a.job_id = j.id
WHERE j.status = 'active'
GROUP BY j.id;
```

Output showed: `Seq Scan on applications`. PostgreSQL was scanning every single row in the applications table. Ouch.

**The fix**: Add indexes on the columns you're filtering and joining on.

```sql
-- Index on job_id for faster JOINs
CREATE INDEX idx_applications_job_id ON applications(job_id);

-- Index on status for faster filtering
CREATE INDEX idx_jobs_status ON jobs(status);

-- Composite index for the date filter
CREATE INDEX idx_applications_applied_at ON applications(applied_at);
```

**Result**: Query time dropped from **1.2 seconds to 45ms**. Just by adding indexes.

### When NOT to Index

Indexes aren't free. They take up disk space. They slow down INSERTs and UPDATEs (because the index needs updating too). And they don't help if the column has low cardinality. Indexing a boolean column? Rarely worth it.

I learned this the hard way by indexing everything. Our INSERT performance dropped by 30% because every write had to update 8 indexes. Turns out you can have too much of a good thing.

**Rule of thumb**: Index columns you filter on (WHERE), join on (JOIN), or sort by (ORDER BY). Don't index columns you never query.

## Lesson 3: Transactions Are Non-Negotiable

Our application had a bug where candidates could apply to the same job multiple times by clicking "Apply" really fast. Double-click and you'd get duplicate applications.

My naive fix:

```javascript
// Check if application exists
const existing = await db.query(
    'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2',
    [jobId, candidateId]
);

if (existing.rows.length === 0) {
    // Insert application
    await db.query(
        'INSERT INTO applications (job_id, candidate_id) VALUES ($1, $2)',
        [jobId, candidateId]
    );
}
```

This still had a race condition. Two requests could both check, see no existing application, and both insert. Duplicates kept happening.

**The fix**: Use a transaction with proper isolation.

```javascript
const client = await pool.connect();
try {
    await client.query('BEGIN');

    const existing = await client.query(
        'SELECT id FROM applications WHERE job_id = $1 AND candidate_id = $2 FOR UPDATE',
        [jobId, candidateId]
    );

    if (existing.rows.length === 0) {
        await client.query(
            'INSERT INTO applications (job_id, candidate_id, status) VALUES ($1, $2, $3)',
            [jobId, candidateId, 'pending']
        );
    }

    await client.query('COMMIT');
} catch (e) {
    await client.query('ROLLBACK');
    throw e;
} finally {
    client.release();
}
```

**Even better**: Use a unique constraint and let the database enforce it.

```sql
ALTER TABLE applications
ADD CONSTRAINT unique_job_candidate
UNIQUE (job_id, candidate_id);
```

Now duplicates are impossible at the database level. PostgreSQL will reject them with an error.

```javascript
try {
    await db.query(
        'INSERT INTO applications (job_id, candidate_id) VALUES ($1, $2)',
        [jobId, candidateId]
    );
} catch (err) {
    if (err.code === '23505') { // Unique violation
        return { error: 'You have already applied to this job' };
    }
    throw err;
}
```

**Lesson**: Don't implement constraints in application code. Use the database.

## Lesson 4: Window Functions for Complex Queries

Product manager: "Can we show the 3 most recent applications for each job?"

My first thought: Loop through jobs in JavaScript, fetch top 3 applications for each.

Yeah, I still hadn't learned my lesson.

A senior dev showed me window functions:

```sql
WITH ranked_applications AS (
    SELECT
        a.*,
        ROW_NUMBER() OVER (PARTITION BY a.job_id ORDER BY a.applied_at DESC) as rn
    FROM applications a
)
SELECT
    j.id,
    j.title,
    ra.candidate_id,
    ra.applied_at,
    ra.status
FROM jobs j
LEFT JOIN ranked_applications ra ON ra.job_id = j.id AND ra.rn <= 3
WHERE j.status = 'active'
ORDER BY j.created_at DESC, ra.rn;
```

This blew my mind. One query, properly ranked results, no loops.

**Window functions** let you perform calculations across sets of rows related to the current row. The ones I use most:
- `ROW_NUMBER()` for assigning row numbers
- `RANK()` for rankings with gaps for ties
- `LAG()/LEAD()` for accessing previous/next rows
- `SUM()/AVG()` for running totals and averages

Another example: "Show each candidate's application count and their rank compared to other candidates"

```sql
SELECT
    candidate_id,
    COUNT(*) as total_applications,
    RANK() OVER (ORDER BY COUNT(*) DESC) as activity_rank
FROM applications
GROUP BY candidate_id
ORDER BY total_applications DESC;
```

One query. No JavaScript loops. Fast.

## Lesson 5: JSONB for Semi-Structured Data

Recruiters wanted to add custom fields to job postings. "Years of experience", "Salary range", "Remote ok?", that sort of thing. But every company wanted different fields.

I had a few options. Add 20 columns to the jobs table (rigid, messy). Create a separate key-value table (slow to query). Or use JSONB, the PostgreSQL way.

```sql
ALTER TABLE jobs ADD COLUMN custom_fields JSONB;

-- Insert with custom fields
INSERT INTO jobs (title, company_id, custom_fields)
VALUES (
    'Senior React Developer',
    123,
    '{"experience_years": 5, "salary_range": "€50k-€70k", "remote": true}'::jsonb
);
```

Query JSON fields like regular columns:

```sql
-- Find remote jobs
SELECT * FROM jobs
WHERE custom_fields->>'remote' = 'true';

-- Find jobs requiring 3+ years experience
SELECT * FROM jobs
WHERE (custom_fields->>'experience_years')::int >= 3;

-- Index JSONB fields for performance
CREATE INDEX idx_jobs_remote ON jobs ((custom_fields->>'remote'));
```

**When to use JSONB**: Schema varies per record (user preferences, custom attributes). You need flexible fields without migrations. You want to query nested data.

**When NOT to use JSONB**: Data is always the same structure (use proper columns). You need referential integrity (foreign keys don't work in JSONB). You're doing frequent updates to nested fields (can be slower).

## Lesson 6: CTEs (WITH Clauses) for Readable Queries

As queries grew complex, they became unreadable. CTEs (Common Table Expressions) saved me:

```sql
-- Without CTEs (hard to read)
SELECT j.*,
       (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as app_count,
       (SELECT AVG(rating) FROM applications WHERE job_id = j.id) as avg_rating
FROM jobs j
WHERE j.company_id IN (SELECT id FROM companies WHERE subscription = 'premium')
ORDER BY app_count DESC;

-- With CTEs (clear and maintainable)
WITH premium_companies AS (
    SELECT id FROM companies WHERE subscription = 'premium'
),
job_stats AS (
    SELECT
        job_id,
        COUNT(*) as application_count,
        AVG(rating) as average_rating
    FROM applications
    GROUP BY job_id
)
SELECT
    j.*,
    COALESCE(js.application_count, 0) as app_count,
    js.average_rating
FROM jobs j
INNER JOIN premium_companies pc ON j.company_id = pc.id
LEFT JOIN job_stats js ON js.job_id = j.id
ORDER BY app_count DESC;
```

CTEs are like functions for SQL. Name your subqueries, reuse them, make your intent clear.

Bonus: CTEs can be recursive. Great for tree structures like comment threads or org charts. Mind-blowing, but I've only needed it twice.

## Lesson 7: Full-Text Search (Without Elasticsearch)

"Can users search job descriptions?"

I almost added Elasticsearch. Then I learned PostgreSQL has built-in full-text search.

```sql
-- Add a tsvector column
ALTER TABLE jobs ADD COLUMN search_vector tsvector;

-- Populate it
UPDATE jobs
SET search_vector =
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''));

-- Index it
CREATE INDEX idx_jobs_search ON jobs USING GIN(search_vector);

-- Search
SELECT id, title, description
FROM jobs
WHERE search_vector @@ to_tsquery('english', 'react & typescript');
```

**Features you get**: Stemming ("running" matches "run"). Stop words ("the", "and" ignored). Ranking by relevance. Language support (English, Italian, etc.).

For most use cases, this beats adding Elasticsearch to your stack. Why add another service if you don't need to?

## Lesson 8: Explain Plans Are Your Best Friend

Whenever a query is slow, run `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE
SELECT * FROM jobs
WHERE company_id = 123
ORDER BY created_at DESC
LIMIT 10;
```

Output tells you everything. Are indexes being used? How many rows are scanned? Where's the bottleneck?

Real example: A query was taking 800ms. EXPLAIN showed a sequential scan on 100k rows. Added an index, same query took 12ms.

Learn to read EXPLAIN output. It's the difference between guessing and knowing.

## What I Learned (And What Changed)

**Before**: I wrote SQL like I was scared of it. Basic CRUD, move all logic to JavaScript.

**After**: I let PostgreSQL do what it's good at. Complex queries, aggregations, constraints, transactions.

**Results**: Query performance improved 10-50x on average. Fewer bugs (database enforces constraints, not application code). Easier to maintain (SQL is declarative, JavaScript loops are imperative). Fewer roundtrips to the database (one query instead of N+1).

**The mental shift**: Stop thinking of the database as a dumb storage layer. It's a powerful computation engine.

## Mistakes I Made Along the Way

### 1. Over-Indexing Everything

I indexed every column I could find. INSERT performance tanked. Indexes cost space and write performance.

**Fix**: Only index what you actually query. Use EXPLAIN to verify indexes are used.

### 2. Not Using Connection Pooling

I created a new database connection for every request. Under load, we hit max connection limits. The app just stopped accepting new requests. Not great.

**Fix**: Use a connection pool (pg-pool, pgbouncer). Reuse connections.

```javascript
// Bad
const client = new Client();
await client.connect();

// Good
const pool = new Pool({ max: 20 });
const client = await pool.connect();
// ... use client
client.release();
```

### 3. Fetching Too Much Data

I did `SELECT *` and filtered in JavaScript. Wasted bandwidth and memory.

**Fix**: Only SELECT the columns you need. Filter in SQL, not in application code.

```sql
-- Bad
SELECT * FROM jobs; -- Then filter in JavaScript

-- Good
SELECT id, title, company_id FROM jobs WHERE status = 'active' LIMIT 50;
```

## Tools I Use Daily

**pgAdmin** for browsing data and running queries. **EXPLAIN ANALYZE** as my built-in query profiler. **pg_stat_statements** (a PostgreSQL extension) for catching slow queries. **Postico** on Mac or **DBeaver** on other platforms when I need something nicer than pgAdmin.

## If I Could Start Over

I'd learn these concepts in this order:

1. **Week 1**: Master JOINs and basic aggregations (GROUP BY, COUNT, SUM)
2. **Week 2**: Understand indexes and when to use them
3. **Week 3**: Learn transactions and constraints
4. **Week 4**: Practice window functions and CTEs
5. **Month 2**: Dive into JSONB, full-text search, query optimization

Skip the "1000 SQL interview questions" tutorials. Build a real project and optimize its queries. You'll learn more in a weekend than weeks of tutorials.

## Your Turn: Level Up Your SQL

Next time you write a query, try this. Run `EXPLAIN ANALYZE` on it. Check if indexes are used. Look for sequential scans on large tables. Ask yourself: "Could the database do this instead of my application code?"

The bar is lower than you think. You don't need to be a DBA to write performant SQL. You just need to appreciate what PostgreSQL can do and learn to leverage it effectively.

These database skills have become one of my strongest assets as a full stack developer. Understanding what happens below the ORM makes you a better engineer at every layer of the stack.
