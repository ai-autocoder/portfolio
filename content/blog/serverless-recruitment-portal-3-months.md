---
title: "Building a Recruitment Portal Solo in 3 Months: Serverless on a Budget"
date: "2026-02-17"
excerpt: "One developer, three months, a small budget, and sensitive candidate data. The serverless architecture that shipped, including the database I didn't build."
tags: [serverless, netlify, nextjs, architecture, nodejs, gdpr]
readTime: 9
image: "../media/img/blog/serverless-recruitment-portal-3-months.svg"
---

# Building a Recruitment Portal Solo in 3 Months: Serverless on a Budget

A small recruitment agency needed its candidates to register online. Not a CV upload: a full registration, with personal details, right-to-work information, bank details for payroll, a health questionnaire, a photo and a signature, arriving at the agency as one complete pack.

They wanted a portal: candidates register online, sign digitally, and the agency receives everything structured and complete. Budget: small. Team: me. Timeline: about three months.

That combination of constraints (solo developer, low budget, fixed timeline, sensitive personal data) drove every architecture decision that followed. This is a post about those decisions, including one that looks wrong on paper and turned out to be the best call of the project.

## The Constraint That Shaped Everything

Here's the thing about a solo project for a small client: you're not just building the system. You're also its future ops team, DBA, and security officer. Every component I added would be mine to patch, monitor, and pay for. Forever, from the client's point of view.

So my selection criteria weren't "what's the best tool". They were "what can one person run safely with near-zero maintenance".

## Decision 1: Next.js on static-plus-serverless

The front end is Next.js with Tailwind CSS, deployed on Netlify. Pages are static where possible; the dynamic part is the multi-step registration flow.

Why Next.js and not plain React? Mostly for the routing, the build pipeline, and the fact that a hiring page needs to be fast and indexable. Why Tailwind? Because on a solo project, a design system I don't have to invent is a week of my life back.

The registration flow is a multi-step form: personal details with a photo taken on the device camera, employment type and bank details, a health questionnaire, employment history, and a declaration with a digital signature. Each step validates before you can move on, because the whole point was to stop incomplete applications from reaching the agency.

```tsx
// Validation runs per step, not on final submit.
// Problems that surface at the END mean the agency chasing a
// candidate days later. Failing fast at each step is the feature.
const handleNextStep = () => {
  if (validateStep(step)) {
    updateFormState(); // progress is kept in sessionStorage
    setStep((prev) => (prev < 4 ? ((prev + 1) as FormStep) : prev));
  }
};
```

## Decision 2: Netlify Functions instead of a server

The backend is Node.js running as Netlify Functions. Submission handling, PDF generation, and all email flows live there.

I considered a small VPS with Express. It would've been more flexible and I know that stack well. But a VPS is a pet: OS updates, TLS renewals, a Node process to keep alive, security patches. For a client with no technical staff, every one of those is a future incident.

Serverless functions took all of that off the table. The trade-offs I accepted: cold starts (fine for a form submission, nobody notices 300ms there), execution time limits (relevant for PDF generation, more below), and vendor lock-in (real, but the functions are plain Node and small enough to port in a day).

## Decision 3: The database I didn't build

This is the one that raises eyebrows. The system has no database.

The flow is: the browser posts the finished form straight to a Netlify Function. The function builds a structured PDF with the candidate's details, photo and signature, emails it to the agency with the photo attached, and sends the candidate a confirmation listing the documents to send back by email reply. The documents themselves never pass through the platform. The agency's system of record stayed what it already was: their vetted internal process, now fed with clean, complete, structured input instead of loose paper.

The client didn't want candidate data sitting in a system they'd have to look after, and by week two I'd reached the same conclusion from the engineering side. I'd sketched a Postgres database in week one. It came out of the design for three reasons:

1. **GDPR.** A database of NI numbers, bank details, health answers and signatures is a liability that needs retention policies, access control, encryption at rest, breach procedures. As a solo contractor delivering a system the client would own, the safest personal data store is the one that doesn't exist. Data passes through, gets delivered to the agency, and the platform itself retains nothing.
2. **Maintenance.** No database means no backups, no migrations, no connection pool exhaustion at the worst moment.
3. **Honest requirements.** The agency needed structured intake, not a candidate management system. Building storage nobody asked for is how small projects become big unfinished ones.

The obvious limitation: no admin dashboard, no "show me all candidates from March". If the agency grows into needing that, the right move is adding a proper database with retention rules at that point. I'd rather extend a working system later than run an unnecessary liability from day one.


## The Part That Fought Back: PDF Generation

Generating the PDF inside a serverless function was the fiddliest part of the project. A headless browser would have given pixel-perfect output, but running one inside a short-lived function means a heavy binary, slow cold starts, and tight memory limits. Not worth it for a form.

So I went with jsPDF and built the document programmatically from the data: a title, then section after section of label and value, the candidate's photo near the top and the signature at the end. Less flexible layout than HTML, and getting the images to sit in the right place took more fiddling than I'd like to admit (the photo position needed its own fix). But it's small, it's plain Node, and there's no browser to babysit.

```ts
// Each field is one call, and every call returns the next y position,
// so sections stack without any layout engine.
yPos = addSectionTitle(doc, "Personal Details", yPos);
yPos = addField(doc, "Full Name", `${surname}, ${firstNames}`, yPos);
yPos = addField(doc, "Date of Birth", dateOfBirth, yPos);
```

## Results

Delivered in the three-month window, October to December, solo:

- Every registration arrives as one structured PDF with photo and signature, instead of details collected piecemeal
- Incomplete applications are blocked at the source: each of the form's steps has to validate before the candidate can move on
- Hosting cost is zero, on a free tier, with no server to maintain, and deploys are automatic on every push through the Netlify/GitHub pipeline
- Sized for the real client: an agency working with somewhere between 10 and 20 drivers, which is why a no-database design fits
- The site has run since launch without an outage I've been called about, which for a solo-maintained system is the metric I care most about


## Lessons Learned

**Constraints are a design tool.** Every decision above came from taking "one developer, small budget, sensitive data" seriously instead of designing the system I'd build with a team of five.

**The best component is often the missing one.** Removing the database removed the majority of the project's long-term risk. I still catch myself defaulting to "obviously it needs a database" on new projects, and I now make myself argue for it rather than from it.

**Serverless is great until it isn't.** For request-response work under a few seconds, it removed a whole category of operations. For the PDF workload it was genuinely awkward, and if the requirements had been heavier (large files, long processing) I would have needed a different execution model. Know where the cliff is before you commit.

**When not to do this:** if the client needs querying, dashboards, or workflows over historical data, the no-database version is the wrong system. This architecture fits pass-through intake with an existing system of record on the other side. It doesn't scale into a SaaS product, and it was never meant to.
