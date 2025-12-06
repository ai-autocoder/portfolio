---
title: "Error Handling Best Practices in Node.js and Python"
date: "2025-05-20"
excerpt: "A 2 AM production bug taught me 'it works on my machine' isn't enough. Here's how I went from console.log(error) to proper error handling in both languages."
tags: [nodejs, python, error-handling, debugging, backend]
readTime: 16
---

# Error Handling Best Practices in Node.js and Python

It was 2 AM. My phone buzzed. Production was down. Users couldn't log in.

I SSH'd into the server, checked the logs, and found this:

```
Error: undefined
    at /app/server.js:47
```

That's it. No context. No stack trace. Just "Error: undefined."

It took me 3 hours to find the bug. A database connection timeout that I'd never handled properly. Three hours of checking everything except the one thing that mattered. I looked at Redis. I looked at the load balancer. I even restarted the server twice.

The database connection pool was exhausted. If I'd logged the actual error with context, I would've seen it in 30 seconds.

That night changed how I write code. Here's what I learned.

## The Problem: My Naive Approach

### Node.js - The "Console.log Everything" Phase

My early Node.js error handling looked like this:

```javascript
app.post('/login', async (req, res) => {
    try {
        const user = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
        // ... rest of login logic
        res.json({ token: 'xyz' });
    } catch (err) {
        console.log(err); // 🚨 This is terrible
        res.status(500).send('Error');
    }
});
```

**Why this sucked**:
- `console.log` goes nowhere in production
- Users see "Error" and have no idea what to do
- Every error looks the same
- Stack traces? Gone forever

### Python - The "Bare Except" Phase

My early Python code wasn't better:

```python
@app.post("/login")
async def login(email: str, password: str):
    try:
        user = await db.fetch_one("SELECT * FROM users WHERE email = $1", email)
        # ... rest of login logic
        return {"token": "xyz"}
    except:  # 🚨 Never do this
        print("Error occurred")
        return {"error": "Something went wrong"}
```

**Why this was worse**:
- Bare `except` catches everything. Even KeyboardInterrupt. I once spent 20 minutes figuring out why Ctrl+C wouldn't stop my script.
- Errors just disappear
- No logs anywhere
- Debugging in production? Good luck

## Lesson 1: Different Errors Need Different Responses

Not all errors are the same. A user typing the wrong email is different from your database being on fire.

It took me way too long to figure this out. I was returning status 500 for everything. Validation error? 500. User not found? 500. Database exploded? Also 500.

### Node.js: Custom Error Classes

```javascript
// Define custom error types
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
        this.statusCode = 500;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}
```

Now I can throw specific errors:

```javascript
app.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ValidationError('Email and password are required');
        }

        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) {
            throw new NotFoundError('User not found');
        }

        // ... rest of login logic
        res.json({ token: generateToken(user) });

    } catch (err) {
        next(err); // Pass to error handler middleware
    }
});
```

### Python: Custom Exception Classes

```python
# Custom exceptions
class ValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        self.status_code = 400

class DatabaseError(Exception):
    def __init__(self, message: str):
        self.message = message
        self.status_code = 500

class NotFoundError(Exception):
    def __init__(self, message: str):
        self.message = message
        self.status_code = 404
```

Using them:

```python
@app.post("/login")
async def login(email: str, password: str):
    if not email or not password:
        raise ValidationError("Email and password are required")

    user = await db.fetch_one("SELECT * FROM users WHERE email = $1", email)

    if not user:
        raise NotFoundError("User not found")

    # ... rest of login logic
    return {"token": generate_token(user)}
```

**FastAPI automatically handles these**:

```python
from fastapi import FastAPI, HTTPException

@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message}
    )
```

## Lesson 2: Centralized Error Handling

I used to have try/catch blocks scattered everywhere. It was a mess. Same logging code copied 50 times across different routes.

Then I learned about middleware. One place to handle all errors. Change your logging format once, it applies everywhere. Beautiful.

### Node.js: Global Error Handler Middleware

```javascript
// Error handler middleware (place AFTER all routes)
app.use((err, req, res, next) => {
    // Log the error (more on logging later)
    console.error({
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Don't leak sensitive info in production
    const message = process.env.NODE_ENV === 'production'
        ? 'An error occurred'
        : err.message;

    res.status(err.statusCode || 500).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});
```

### Python (FastAPI): Global Exception Handler

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

app = FastAPI()
logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the error
    logger.error(
        f"Error occurred: {exc}",
        extra={
            "url": str(request.url),
            "method": request.method,
            "client": request.client.host
        },
        exc_info=True  # Includes stack trace
    )

    # Generic error response
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred"}
    )
```

## Lesson 3: Actual Logging (Not Console.log)

That 2 AM incident? I couldn't debug it because I had no logs. Well, I had console.log statements everywhere, but those don't show up in production logs when you're using PM2 or Docker without proper configuration.

I learned this the expensive way.

### Node.js: Winston for Structured Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        // Log errors to error.log
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        // Log everything to combined.log
        new winston.transports.File({ filename: 'combined.log' }),
        // Also log to console in development
        ...(process.env.NODE_ENV !== 'production'
            ? [new winston.transports.Console({ format: winston.format.simple() })]
            : [])
    ]
});

// Use it in your error handler
app.use((err, req, res, next) => {
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userId: req.user?.id,  // If user is authenticated
        timestamp: new Date().toISOString()
    });

    res.status(err.statusCode || 500).json({ error: err.message });
});
```

Now errors go to a file I can actually access. The JSON format means I can grep for specific errors or pipe them into jq for analysis.

### Python: Structured Logging

```python
import logging
import json
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[
        logging.FileHandler('error.log'),
        logging.StreamHandler()  # Console output
    ]
)

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Structured log entry
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": "ERROR",
        "message": str(exc),
        "url": str(request.url),
        "method": request.method,
        "client_ip": request.client.host,
        "stack_trace": traceback.format_exc()
    }

    logger.error(json.dumps(log_entry))

    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred"}
    )
```

**Real talk**: Use a log aggregation service in production. Datadog, Sentry, LogRocket, whatever. SSHing into a server to tail log files at 2 AM is not fun. I've been there. Don't be there.

## Lesson 4: Async Errors Will Bite You

Async code breaks error handling if you're not careful. And I wasn't careful for way too long.

### Node.js: Unhandled Promise Rejections

```javascript
// BAD: Unhandled promise rejection
app.get('/users', async (req, res) => {
    const users = await db.query('SELECT * FROM users'); // If this fails, Express doesn't catch it
    res.json(users);
});
```

If `db.query` throws, Express won't catch it. Your server might crash.

**Fix 1: Wrap in try/catch**

```javascript
app.get('/users', async (req, res, next) => {
    try {
        const users = await db.query('SELECT * FROM users');
        res.json(users);
    } catch (err) {
        next(err);
    }
});
```

**Fix 2: Use express-async-errors** (my favorite)

```javascript
require('express-async-errors'); // At the top of your file

// Now async errors are automatically caught. It's like magic.
app.get('/users', async (req, res) => {
    const users = await db.query('SELECT * FROM users');
    res.json(users);
});
```

This library saved me so much pain. Install it. Use it. Thank me later.

**Fix 3: Global safety net**

```javascript
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { reason, promise });
    // Don't exit in production (unless you have auto-restart)
    // process.exit(1);
});
```

### Python: FastAPI Just Works

FastAPI catches async errors automatically. This is one of the reasons I love FastAPI. It just handles this stuff for you.

```python
@app.get("/users")
async def get_users():
    users = await db.fetch_all("SELECT * FROM users")  # Errors are caught automatically
    return users
```

## Lesson 5: Retry Logic for Transient Failures

Some errors are temporary (network glitches, database connection timeouts). Retry them.

### Node.js: Retry with Exponential Backoff

```javascript
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            return response.json();
        } catch (err) {
            if (i === retries - 1) throw err; // Last attempt failed

            logger.warn(`Retry ${i + 1}/${retries} for ${url} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}
```

### Python: Tenacity Library

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
async def fetch_with_retry(url: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
```

**When to retry**:
- Network errors (yes)
- Database connection timeouts (yes)
- 5xx server errors (maybe, depends on the API)

**When not to**:
- 4xx client errors (no, the user sent bad data, retrying won't fix it)
- Logic errors in your code (no, fix your bug instead)

## Lesson 6: Stop Showing Users Your Database Errors

I once showed a user this error message: "Error: column 'emai' does not exist"

They called support. Support called me. I felt like an idiot.

Users don't care about your typos in SQL queries. They want to know if they can complete their task or not.

### Translate Technical Errors

```javascript
function getUserFriendlyMessage(err) {
    if (err.code === '23505') {
        // PostgreSQL unique violation
        return 'An account with this email already exists';
    }
    if (err.code === 'ECONNREFUSED') {
        return 'Unable to connect to the database. Please try again later.';
    }
    if (err instanceof ValidationError) {
        return err.message; // Already user-friendly
    }
    // Default
    return 'An unexpected error occurred. Please try again.';
}

app.use((err, req, res, next) => {
    logger.error(err); // Log the technical error
    res.status(err.statusCode || 500).json({
        error: getUserFriendlyMessage(err) // Show user-friendly message
    });
});
```

## Lesson 7: Monitor Errors Before Users Complain

Logs are reactive. You see the error after it breaks.

Monitoring is proactive. You see the error the second it happens. Sometimes before the user even notices.

I wish I'd set this up earlier. Would've saved so many angry customer emails.

### Sentry Changed Everything

I use Sentry for both Node.js and Python. It's free for small projects and worth every penny for bigger ones.

What it does:
- Catches errors automatically
- Groups similar errors together (so one bug doesn't look like 500 bugs)
- Alerts when error rates spike
- Shows you how many users are affected

```javascript
// Node.js
const Sentry = require('@sentry/node');

Sentry.init({ dsn: process.env.SENTRY_DSN });

// Errors are automatically captured
app.use(Sentry.Handlers.errorHandler());
```

```python
# Python
import sentry_sdk

sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))

# Errors are automatically captured
```

Set it up once and you get Slack notifications when errors happen. Often before users even report them.

## Lesson 8: Test Your Error Handling

I hate writing tests. But you know what I hate more? Broken error handling that only fails in production.

If you don't test it, assume it's broken.

### Node.js: Testing Error Cases

```javascript
// Using Jest
describe('POST /login', () => {
    it('should return 400 if email is missing', async () => {
        const res = await request(app)
            .post('/login')
            .send({ password: 'test123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email and password are required');
    });

    it('should return 404 if user not found', async () => {
        const res = await request(app)
            .post('/login')
            .send({ email: 'notfound@example.com', password: 'test123' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('User not found');
    });

    it('should handle database errors gracefully', async () => {
        // Mock database failure
        jest.spyOn(db, 'query').mockRejectedValue(new Error('DB connection failed'));

        const res = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'test123' });

        expect(res.status).toBe(500);
    });
});
```

### Python: Testing with pytest

```python
def test_login_missing_email(client):
    response = client.post("/login", json={"password": "test123"})
    assert response.status_code == 422  # FastAPI validation error

def test_login_user_not_found(client):
    response = client.post("/login", json={"email": "notfound@example.com", "password": "test123"})
    assert response.status_code == 404
    assert response.json()["error"] == "User not found"

def test_database_error_handling(client, mocker):
    # Mock database failure
    mocker.patch("app.db.fetch_one", side_effect=Exception("DB error"))
    response = client.post("/login", json={"email": "test@example.com", "password": "test123"})
    assert response.status_code == 500
```

## What Actually Changed

**Before I fixed all this**:
- Debugging production issues took 2-3 hours on average
- Users saw "Error 500" for everything
- No idea what was actually breaking
- Server crashed regularly from unhandled promise rejections

**After**:
- Sentry pings me the second something breaks
- Users get actual helpful error messages
- I can search logs by user ID, timestamp, URL, whatever
- Server hasn't crashed in 4 months

**Real numbers**:
- **Mean Time to Resolution**: Dropped from ~3 hours to ~20 minutes
- **Support tickets**: "Site is broken" tickets down by 60%
- **Error visibility**: I can see patterns now. Errors spike on Fridays? Check last Friday's deploy
- **Sleep quality**: Significantly better (fewer 2 AM phone calls)

## My Error Handling Checklist

For every new endpoint, I now ensure:

- [ ] Custom error types defined (ValidationError, NotFoundError, etc.)
- [ ] Try/catch around async operations
- [ ] Errors logged with context (user ID, request URL, timestamp)
- [ ] User-friendly error messages (no stack traces to users)
- [ ] Retry logic for transient failures
- [ ] Tests for error cases
- [ ] Monitoring enabled (Sentry or equivalent)

## Common Mistakes I Still See (And Sometimes Still Make)

### 1. Swallowing Errors

```javascript
try {
    await somethingRisky();
} catch (err) {
    // Do nothing
}
```

I did this last month. Spent an hour debugging why a feature "wasn't working" before realizing I was catching and ignoring the error.

If you catch it, at least log it. Silent failures are the worst.

### 2. Exposing Sensitive Info

```javascript
catch (err) {
    res.json({ error: err.stack }); // Stack traces reveal file paths, libraries, etc.
}
```

Show stack traces in development. Hide them in production.

### 3. Returning 500 for Everything

I was doing this for years. Validation error? 500. User not found? 500. My code crashed? Also 500.

Be specific. It helps.

```javascript
// Bad (this was me)
catch (err) {
    res.status(500).send('Error');
}

// Better
catch (err) {
    if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
}
```

## What I Wish I'd Known Earlier

I learned error handling after breaking production. That's the hard way.

If I could talk to junior me, I'd say: learn this stuff in week 1. Not month 6 when you're getting woken up at 2 AM.

**Start with these**:
1. Custom error classes (1 hour to learn)
2. Centralized error handler (30 minutes to set up)
3. Structured logging with Winston or Python's logging module
4. Sentry for monitoring (free tier is fine)
5. Write tests for your error cases

None of this is advanced. It's all fundamental stuff that somehow doesn't get taught in tutorials.

## Try This Exercise

Open your most recent project right now. Ask yourself:

1. What happens if the database goes down?
2. What do users actually see when something breaks?
3. Could you debug a production error with your current logs?
4. Are you even logging errors? Monitoring them?
5. Have you written a single test for error cases?

If those questions make you uncomfortable, that's actually a good sign. It means you're thinking critically about your systems.

The investment in proper error handling pays off every single day. Not just in fewer incidents, but in the confidence you have when shipping new features.

Build systems you can trust. Future you will thank you.
