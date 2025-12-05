---
title: "Building with AI: When to Trust AI-Generated Code (and When Not To)"
date: "2025-08-05"
excerpt: "AI tools wrote 40% of my last project. But blindly trusting them caused a production bug that took down our API for 3 hours. Here's what I learned about using AI effectively without breaking things."
tags: [ai, copilot, claude, productivity, code-quality]
readTime: 17
---

# Building with AI: When to Trust AI-Generated Code (and When Not To)

I shipped a bug to production that took down our API for 3 hours.

The code looked perfect. It passed code review. It even had tests.

But it had a subtle race condition that only appeared under load. The kind that doesn't show up until you're processing 50 job postings per minute.

**The code was written by GitHub Copilot.** And I trusted it without understanding it.

That was 6 months ago. I still use AI tools daily, but I've learned when to trust them and when to dig deeper.

## The Incident: What Went Wrong

I was building an API endpoint to create job postings in our recruitment platform. GitHub Copilot suggested this:

```javascript
app.post('/jobs', async (req, res) => {
    const { title, description, companyId } = req.body;

    // AI-generated code
    const job = await db.query(
        'INSERT INTO jobs (title, description, company_id) VALUES ($1, $2, $3) RETURNING *',
        [title, description, companyId]
    );

    // Send notification email to recruiters
    sendNotificationEmail(job.rows[0]);

    res.status(201).json(job.rows[0]);
});
```

Looked fine. I shipped it.

**The bug**: `sendNotificationEmail` was async, but I didn't await it. Under load, errors in email sending weren't caught and crashed the process. Every time the email service hiccupped, the entire API went down.

**Why I missed it**: The code looked clean. Copilot wouldn't suggest broken code, right?

Wrong.

## What AI Tools Are Actually Good At

After using Claude Code, GitHub Copilot, and ChatGPT for 18 months, I've figured out where they shine and where they fall flat.

### Boilerplate Code

AI is great at repetitive patterns. Like, really great:

```javascript
// I type: "express route for user CRUD"
// Copilot suggests:
app.get('/users', async (req, res) => {
    const users = await db.query('SELECT * FROM users');
    res.json(users);
});

app.post('/users', async (req, res) => {
    const { name, email } = req.body;
    const user = await db.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
    );
    res.status(201).json(user.rows[0]);
});

// ... similar for PUT, DELETE
```

This is 90% correct. I still verify it, but it saves me 10 minutes of typing every time.

### Test Cases

AI generates test cases I wouldn't have thought of:

```javascript
// I write:
describe('POST /jobs', () => {
    it('should create a job', async () => {
        // ...
    });
});

// Copilot suggests more tests:
it('should return 400 if title is missing', async () => {
    const res = await request(app)
        .post('/jobs')
        .send({ description: 'Test' });
    expect(res.status).toBe(400);
});

it('should return 400 if title is too long', async () => {
    const res = await request(app)
        .post('/jobs')
        .send({ title: 'x'.repeat(300), description: 'Test' });
    expect(res.status).toBe(400);
});

it('should sanitize HTML in job description', async () => {
    // This test caught a XSS vulnerability!
});
```

AI thought of edge cases I missed. I run them to make sure they actually catch real issues, not just look comprehensive.

### Refactoring

AI is decent at simplifying code:

```javascript
// My messy code:
if (user.role === 'admin') {
    if (user.isActive) {
        if (user.permissions.includes('delete')) {
            return true;
        }
    }
}
return false;

// AI suggests:
return user.role === 'admin' &&
       user.isActive &&
       user.permissions.includes('delete');
```

Cleaner, but I still verify the logic is identical. I've been burned before by refactorings that looked equivalent but weren't.

### Documentation

AI writes clearer comments than I do:

```javascript
// I write:
function processData(data) { /* ... */ }

// AI suggests:
/**
 * Processes raw job data from the database and transforms it for API response.
 *
 * @param {Object} data - Raw database record
 * @param {string} data.title - Job title
 * @param {number} data.salary - Annual salary in EUR
 * @returns {Object} Formatted job object with calculated fields
 */
function processData(data) { /* ... */ }
```

Documentation is pretty low-risk. I still read it to make sure it's accurate, but AI rarely screws this up.

## What AI Tools Are Bad At

### Complex Business Logic

AI doesn't understand your specific requirements.

**My prompt**: "Write a function to calculate candidate match score"

**AI's suggestion**:
```javascript
function calculateMatchScore(candidate, job) {
    let score = 0;
    if (candidate.skills.includes(job.requiredSkill)) score += 50;
    if (candidate.yearsExperience >= job.minExperience) score += 30;
    if (candidate.location === job.location) score += 20;
    return score;
}
```

**Problems**:
- My scoring algorithm is more complex (weighted skills, partial matches)
- Doesn't handle edge cases (what if skills is null?)
- "location match" isn't how our platform works

AI gave me a starting point, but I rewrote 80% of it. The structure was useful, the implementation wasn't.

### Security-Sensitive Code

This is where AI gets dangerous.

**My prompt**: "JWT authentication middleware"

**AI's suggestion**:
```javascript
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
```

**Problems**:
- Doesn't handle "Bearer <token>" format
- Secret should be more complex
- No token expiration check
- Vulnerable to timing attacks

I never trust AI for security code. Never. Review it like you're auditing someone else's code. Assume it's wrong until proven right.

### Performance-Critical Code

AI often suggests readable code, not fast code:

```javascript
// AI suggests (clean but slow):
const activeJobs = jobs.filter(job => job.isActive);
const sortedJobs = activeJobs.sort((a, b) => b.createdAt - a.createdAt);
const topJobs = sortedJobs.slice(0, 10);

// Better (single pass):
const topJobs = jobs
    .filter(job => job.isActive)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

// Even better (for large datasets, do this in SQL):
const topJobs = await db.query(`
    SELECT * FROM jobs
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 10
`);
```

AI doesn't optimize unless you explicitly ask. And even then, you need to verify the results.

### Database Queries

AI sometimes generates inefficient queries. Like, really inefficient:

**My prompt**: "Get users and their job applications"

**AI's suggestion**:
```javascript
const users = await db.query('SELECT * FROM users');
for (let user of users) {
    user.applications = await db.query(
        'SELECT * FROM applications WHERE user_id = $1',
        [user.id]
    );
}
```

**Problem**: N+1 query problem. For 100 users, that's 101 database calls. I didn't catch this until staging, when I noticed the endpoint was taking 2 seconds to respond.

**Fix (that I had to write)**:
```javascript
const users = await db.query(`
    SELECT u.*, json_agg(a.*) as applications
    FROM users u
    LEFT JOIN applications a ON a.user_id = u.id
    GROUP BY u.id
`);
```

Always check for N+1 queries. Always.

## My Framework: When to Trust AI Code

I use this mental checklist for every AI suggestion.

**High trust (quick review, then ship):**
- Boilerplate CRUD operations
- Standard patterns (Express routes, React components)
- Test cases (but run them to verify)
- Documentation and comments
- Code formatting

**Medium trust (review carefully):**
- Refactoring suggestions
- Database queries (check for N+1 issues)
- Error handling
- Input validation
- Simple algorithms

**Low trust (verify extensively):**
- Security code (auth, encryption, etc.)
- Complex business logic
- Performance-critical code
- State management
- Async/concurrency patterns

**Never trust (always rewrite from scratch):**
- Code involving money or payments
- Medical/safety-critical logic
- Cryptography
- Anything you don't fully understand

If I can't explain what the code does, I don't ship it. Period.

## Real Examples from My Work

### AI Saved Me Hours: Contact Form

**Task**: Build a contact form submission handler

**AI-generated code**:
```javascript
app.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;

    // Validate inputs
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields required' });
    }

    // Send email
    await sendEmail({
        to: 'contact@mysite.com',
        subject: `New contact from ${name}`,
        body: message,
        replyTo: email
    });

    res.json({ success: true });
});
```

**What I changed**: Added rate limiting, email regex validation, HTML sanitization.

**Time saved**: About 30 minutes. Would've taken me 45 minutes to write from scratch, took 15 to review and add the missing security bits.

### AI Almost Broke Production: Password Hashing

**Task**: Hash user passwords

**AI's suggestion**:
```javascript
const bcrypt = require('bcrypt');
const hashedPassword = bcrypt.hashSync(password, 10);
```

Looks fine, right?

**Problem**: `hashSync` is blocking. Under load, this freezes the event loop.

**Fix**:
```javascript
const hashedPassword = await bcrypt.hash(password, 10); // Async version
```

**Lesson**: AI doesn't always know the best library method. I had to know that `hashSync` blocks the event loop. You can't rely on AI to know this stuff.

### AI Wrote Better Tests Than Me

**Task**: Test input validation

**My test**:
```javascript
it('should reject invalid email', async () => {
    const res = await request(app)
        .post('/users')
        .send({ email: 'invalid' });
    expect(res.status).toBe(400);
});
```

**AI's suggestions** (way more thorough):
```javascript
describe('Email validation', () => {
    const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
        null,
        undefined,
        'a'.repeat(300) + '@example.com'
    ];

    invalidEmails.forEach(email => {
        it(`should reject ${email}`, async () => {
            const res = await request(app)
                .post('/users')
                .send({ email });
            expect(res.status).toBe(400);
        });
    });
});
```

**Result**: Caught edge cases I hadn't thought of. This was genuinely helpful.

## How I Actually Use These Tools

### GitHub Copilot

I use Copilot for boilerplate, completing patterns I've started, and generating test cases.

My typical workflow: write a comment describing what I want, let Copilot suggest something, then review and modify before shipping.

```javascript
// Create a middleware to log request duration
// [Copilot generates the code]
// I review: looks good, add it
```

I always review. Always.

### Claude Code

I use Claude for the more complex stuff: refactoring large files, explaining unfamiliar codebases, generating documentation, brainstorming architecture.

Example: "Refactor this 500-line file to use async/await instead of callbacks." Claude generates a refactored version. I review it, test it, then merge if it looks good.

Great for exploration. But I always verify the output.

### ChatGPT

ChatGPT is my learning tool. I use it for understanding new libraries, debugging cryptic errors, and generating example code.

I'll paste an error message and ask for an explanation. Or ask for code examples (then modify them for my use case). Or request comparisons like "FastAPI vs Flask."

For production code? Low trust. For learning? High trust.

## The Rules I Follow

**I must understand every line.** If I can't explain what the AI-generated code does, I don't ship it. "This looks right, ship it" isn't good enough. It needs to be "I understand this handles X, Y, Z. I tested edge cases A, B, C. Ship it."

**AI doesn't replace tests.** AI-generated code must pass the same tests as human-written code. I don't lower my standards because "AI wrote it."

**Security code gets extra scrutiny.** Anything involving authentication, authorization, encryption, or user data gets reviewed like I'm auditing someone else's code. Assume it's wrong until proven right.

**Performance is my responsibility.** AI optimizes for readability, not speed. If performance matters, I profile and optimize myself.

**I'm accountable, not the AI.** When AI-generated code breaks production, it's MY fault, not the AI's. I own every line of code I ship, regardless of who (or what) wrote it.

## What Changed in My Workflow

**Before AI tools**:
- Writing boilerplate: 30% of my time
- Thinking/architecting: 40%
- Debugging: 20%
- Code review: 10%

**With AI tools**:
- Writing boilerplate: 10% (AI does most of it)
- Thinking/architecting: 40% (same)
- Debugging: 15%
- Reviewing AI code: 20%
- Code review: 15%

**Net result**: ~20% more productive, but I spend more time reviewing and less time typing.

## Metrics: AI Impact on My Projects

### Project: CargoCrew Recruitment Platform

**AI-generated code**: ~40% of final codebase
**Time saved**: ~30 hours (over 3 months)
**Bugs from AI code**: 3 (all caught in testing)
**Bugs in human code**: 7

**Takeaway**: AI code isn't buggier than my code, but I review it more carefully.

### Project: Portfolio Website

**AI-generated code**: ~20%
**Time saved**: ~5 hours
**Bugs from AI code**: 0

**Takeaway**: For simple projects, AI is incredibly useful and low-risk.

## Common Mistakes I See (And Made)

**Shipping without understanding.** I've heard colleagues say "I don't know what this does, but Copilot suggested it and tests pass." Tests can miss things. If you don't understand the code, you can't debug it at 2 AM.

**Not testing AI code.** "AI wrote it, it's probably fine" is not a testing strategy. Test AI code like you test human code. More, even.

**Trusting AI for security.** I've seen AI suggest storing passwords in plain text, using `eval()` on user input, and weak encryption schemes. Never trust AI for security-critical code.

**Over-relying on AI for learning.** Junior devs who use AI too much don't learn fundamentals. Use AI to speed up tasks you understand, not to avoid learning.

## The Future

AI tools will get better. They'll understand your entire codebase, suggest better fixes for errors, and catch more vulnerabilities.

But some things won't change. You'll still need to understand code. You'll still be responsible for what ships. AI is a tool, not a replacement for thinking.

## What I've Learned

Use AI for boilerplate and repetitive tasks. But review every line. Test extensively. Learn from the suggestions instead of just copying them. Stay accountable for all code you ship.

And if you can't explain the code at 2 AM when production is down? Don't ship it.

AI makes me about 20% more productive. But that's because I spend less time typing and more time reviewing. I'm not coding less, I'm thinking more.

The incident I mentioned at the start taught me something valuable: AI is a powerful accelerator, but the developer remains accountable. That mindset shift made me better at using these tools effectively.

Today, I ship faster and catch more edge cases than I did before AI tools existed. The key is treating AI as a skilled collaborator that still needs your oversight, not a replacement for understanding your code.

Use AI to go faster, not to think less.

