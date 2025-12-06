---
title: "How I Stopped Breaking Production While Refactoring Code"
date: "2024-08-20"
excerpt: "Hard-won lessons from breaking production three times: how to safely refactor legacy code with tests first, incremental changes, and respect for working code."
tags: [refactoring, legacy-code, testing, best-practices, software-engineering]
readTime: 8
---

# Refactoring Legacy Code: How I Stopped Breaking Production (After 3 Incidents)

I've broken production three times while "improving" legacy code. Each time I thought "this refactoring is simple, what could go wrong?"

Turns out: a lot.

The third incident was the worst. I spent two weeks refactoring a pricing calculation module. Made it beautiful. Clean functions, proper separation of concerns, the works. Deployed on a Friday (I know, I know).

By Monday morning, we had 47 support tickets. Certain booking combinations were calculating wrong prices. I'd "fixed" an apparent bug that was actually a feature one client depended on.

Here's what I've learned about refactoring legacy code safely, mostly through painful experience.

## Rule #1: It's Working, Even If You Don't Know Why

The worst mindset you can have is "this code is terrible, I'll just rewrite it." I know because that was my mindset for the first two years of my career.

That "terrible" code is running a business. It has edge cases you don't know about. It handles scenarios you haven't encountered. It's been battle-tested in production.

Your beautiful refactored version? It's untested theory.

## The Problem with Legacy Code (It's Not What You Think)

Most developers think legacy code is bad because it's poorly structured, missing comments, or using outdated patterns.

The real problem is simpler: **you don't understand it yet.**

I once encountered a function that was 200 lines, nested 6 levels deep, with variables named `tmp`, `data2`, and `result_final`. My first thought was "whoever wrote this should be ashamed."

Then I spent two days understanding the business logic. Turns out, it was handling incredibly complex pricing rules. The nesting was actually necessary. The variable names were terrible, but the logic was sound.

Could it be better? Sure. But it worked. And working code pays the bills.

## The Safe Refactoring Process

Here's the process I use now, after breaking production enough times to learn better:

### Step 1: Add Tests First (Not After)

I know, I know. Everyone says "write tests." But when I started, I'd refactor first, then add tests to the new code.

Wrong order.

**Write tests for the current, ugly code first.** Before you change anything.

```javascript
// The ugly legacy code
function calculatePrice(booking) {
  let price = booking.basePrice;
  if (booking.season === 'high') {
    price = price * 1.5;
  }
  if (booking.groupSize > 10) {
    price = price * 0.9;
  }
  if (booking.earlyBird) {
    price = price * 0.85;
  }
  return Math.round(price * 100) / 100;
}

// Test for the ugly code BEFORE refactoring
describe('calculatePrice', () => {
  it('applies high season markup', () => {
    const booking = { basePrice: 100, season: 'high', groupSize: 5, earlyBird: false };
    expect(calculatePrice(booking)).toBe(150);
  });

  it('applies group discount', () => {
    const booking = { basePrice: 100, season: 'low', groupSize: 15, earlyBird: false };
    expect(calculatePrice(booking)).toBe(90);
  });

  it('stacks discounts correctly', () => {
    const booking = { basePrice: 100, season: 'low', groupSize: 15, earlyBird: true };
    expect(calculatePrice(booking)).toBe(76.5); // 100 * 0.9 * 0.85
  });
});
```

These tests are your safety net. If you refactor and the tests still pass, you probably didn't break anything.

### Step 2: Understand the Code Completely

Don't refactor code you don't understand. Full stop.

I learned this the hard way when I "simplified" a validation function that looked redundant. Turned out it was handling a specific edge case for one client. That client's bookings started failing.

How to actually understand legacy code:

**1. Trace through with real data**
```javascript
// Add console.logs everywhere
function oldFunction(data) {
  console.log('Input:', data);
  let result = doSomething(data);
  console.log('After doSomething:', result);
  result = doSomethingElse(result);
  console.log('After doSomethingElse:', result);
  return result;
}
```

Run it with production-like data. See what actually happens.

**2. Ask people who know**
That function that makes no sense? There's usually someone who knows why it's that way. Find them. Buy them coffee. Ask questions.

**3. Check version control history**
```bash
git log -p -- path/to/weird-file.js
git blame path/to/weird-file.js
```

Often the commit message explains why something was done a certain way. Or at least who to ask.

### Step 3: Refactor in Small Steps

Here's my biggest mistake: trying to refactor everything at once.

I'd take a 500-line function and rewrite it completely. Then spend hours debugging why it didn't work the same way. "But I made it so much better!" I'd tell myself while frantically adding console.logs at 11 PM.

Better approach: tiny, incremental changes.

**Bad: Big Bang Refactor**
```javascript
// Before: 200 lines of spaghetti
function processBooking(booking) {
  // ...200 lines of complex logic
}

// After: Complete rewrite
function processBooking(booking) {
  const validator = new BookingValidator();
  const pricer = new PricingEngine();
  const notifier = new NotificationService();
  // ...50 lines of new, "better" code
}
```

If this breaks, how do you know what broke it? The validator? The pricer? The notifier? Good luck.

**Good: Incremental Refactor**

```javascript
// Step 1: Extract one piece
function processBooking(booking) {
  const price = calculatePrice(booking); // Extracted function
  // ...rest of the 200 lines
}

// Deploy. Test. Verify it works.

// Step 2: Extract another piece
function processBooking(booking) {
  const price = calculatePrice(booking);
  const validated = validateBooking(booking); // Extracted function
  // ...rest of the code
}

// Deploy. Test. Verify it works.

// Step 3: Continue...
```

Each step is small. Each step can be tested. Each step can be rolled back if needed.

### Step 4: Use the Strangler Fig Pattern

I mentioned this in my jQuery migration article, but it's worth repeating because it's saved me so many times.

Don't replace the old code. Wrap it.

```javascript
// Old, ugly function
function calculatePriceOld(booking) {
  // ...ugly but working code
}

// New, beautiful function
function calculatePriceNew(booking) {
  // ...clean, well-structured code
}

// Wrapper that uses both
function calculatePrice(booking) {
  const oldPrice = calculatePriceOld(booking);
  const newPrice = calculatePriceNew(booking);

  // Compare results
  if (Math.abs(oldPrice - newPrice) > 0.01) {
    console.error('Price mismatch!', { oldPrice, newPrice, booking });
    // Alert monitoring system
  }

  // Use old price for now (safe)
  return oldPrice;
}
```

Run both in production. Compare results. When you're confident the new version is correct, switch over.

Then later, delete the old code.

### Step 5: Feature Flags for Big Changes

For anything risky, use feature flags.

```javascript
function processBooking(booking) {
  if (featureFlags.isEnabled('new-pricing-logic')) {
    return processBookingNew(booking);
  } else {
    return processBookingOld(booking);
  }
}
```

This lets you:
- Test in production with real data
- Roll back instantly if something breaks
- Gradually roll out (10% of users, then 50%, then 100%)

I use a simple feature flag system:

```javascript
// featureFlags.js
const flags = {
  'new-pricing-logic': process.env.ENABLE_NEW_PRICING === 'true'
};

export const featureFlags = {
  isEnabled: (flagName) => flags[flagName] || false
};
```

For more complex setups, use LaunchDarkly or similar.

## Common Refactoring Mistakes (That I Made)

### Mistake #1: Assuming the Tests Are Complete

I added tests, felt confident, refactored, and then broke edge cases the tests didn't cover.

The tests gave me false confidence. I had 100% code coverage! What could go wrong?

Turns out: plenty.

**Lesson**: Tests are necessary but not sufficient. Also do manual testing, code review, and gradual rollout.

### Mistake #2: Improving "Bad" Code That Wasn't Actually Bad

I spent a week refactoring a function that "didn't follow best practices." Made it beautiful. Clean. Well-structured.

Then my manager asked: "Did this fix a bug or add a feature?"

Me: "No, but the code is much better now!"

Manager: "Great. We still need that feature by Friday."

Ouch.

**Lesson**: Refactor when there's a reason. Not just because you can.

Good reasons to refactor:
- Fixing a bug is hard because the code is complex
- Adding a feature requires understanding spaghetti code
- Performance is poor and refactoring will help
- The code is actively causing bugs

Bad reasons:
- It doesn't match my preferred style
- I'm bored
- I want to learn a new pattern

### Mistake #3: Refactoring Without Understanding the Business Logic

I "simplified" a complex if-else chain into a clean switch statement. Broke subtle business rules I didn't know existed.

```javascript
// Old code (that I thought was redundant)
if (booking.type === 'standard' && booking.region === 'EU') {
  price *= 1.1;
} else if (booking.type === 'standard') {
  price *= 1.0;
} else if (booking.type === 'premium' && booking.region === 'EU') {
  price *= 1.3;
}
// etc...

// My "improvement"
const multipliers = {
  'standard-EU': 1.1,
  'standard': 1.0,
  'premium-EU': 1.3
};
price *= multipliers[`${booking.type}-${booking.region}`] || 1.0;
```

Looks cleaner, right?

Except the old code had a subtle bug where 'premium' bookings outside EU got the wrong price. Turns out that bug was actually a feature. One client depended on it.

My refactor "fixed" the bug, which broke their integration.

**Lesson**: Understand the "why" before changing the "how."

### Mistake #4: Not Communicating Changes

I refactored a module and didn't tell anyone. A teammate was working on a related feature. Our changes conflicted. Merge hell ensued.

**Lesson**: Communicate refactoring plans, especially for shared code.

## When NOT to Refactor

Sometimes the right answer is: don't.

**Don't refactor if:**

**1. It's working and rarely changes**

That 5-year-old report generation code that nobody touches? Leave it alone. I wasted three days "improving" a reporting module that runs once a month. Nobody cared except me.

**2. You're about to delete it anyway**

We're replacing this module next quarter? Don't refactor it this quarter. I refactored code two weeks before we deleted the entire feature. That was dumb.

**3. You don't understand it**

Seriously. Stop. Figure it out first.

**4. The business needs features, not cleaner code**

Sometimes messy code that ships is better than perfect code that's late.

## The Refactoring Checklist I Actually Use

Before any refactoring, I go through this:

- [ ] Do I understand what this code does?
- [ ] Do I understand WHY it does it this way?
- [ ] Have I written tests for current behavior?
- [ ] Is there a business reason to refactor?
- [ ] Can I do this in small, safe steps?
- [ ] Have I communicated with my team?
- [ ] Do I have a rollback plan?
- [ ] Am I willing to own this if it breaks?

If any answer is "no," I reconsider.

## The Results

Over 18 months, we refactored about 40% of a legacy codebase using these techniques.

What happened:
- Bug rate decreased by roughly 30%
- New features shipped about 25% faster
- Developer satisfaction up (based on informal surveys and fewer complaints in Slack)
- Zero major production incidents from refactoring

That last one still surprises me. Zero incidents. After breaking production three times in my first year, I ended up with zero incidents over 18 months of constant refactoring.

How we did it:
- Small, incremental changes
- Tests before refactoring
- Code review for every change
- Feature flags for risky changes
- Never refactored without a reason

## Your Action Plan

If you're staring at legacy code wondering where to start, here's what actually worked for me:

**Week 1:**
- Pick the smallest, most isolated piece (resist the urge to tackle the worst part first)
- Understand it completely
- Write tests for current behavior

**Week 2:**
- Refactor in tiny steps
- Test after each step
- Deploy incrementally

**Week 3:**
- Monitor production closely
- Fix any issues immediately
- Document what you learned

**Week 4:**
- Pick the next piece
- Repeat

Over time, the codebase gets better. But it takes patience. I know that's not sexy advice, but it works.

## The Hard Truth

Refactoring legacy code is slow, unglamorous, risky, and necessary.

It's not the fun part of programming. You won't get to use the latest framework or learn a new language. You'll spend hours understanding why someone used a triple-nested loop when a map would work. You'll debug issues that only happen with specific data combinations. You'll write tests for code that makes you sad.

But it's how you become a senior developer.

Anyone can write greenfield code. The skill that truly sets developers apart is improving existing systems without breaking them, and doing it systematically. That's what creates real business value and earns trust from your team.

These techniques transformed how I approach legacy code. Instead of dreading it, I now see it as an opportunity to make a measurable impact.

Your future self (and your teammates) will thank you.
