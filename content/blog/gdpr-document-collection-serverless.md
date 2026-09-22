---
title: "Sensitive Candidate Data Without a Database: GDPR on Serverless"
date: "2026-03-11"
excerpt: "NI numbers, bank details, health answers, a photo and a signature. How a small serverless intake pipeline handled GDPR by keeping none of it on the platform."
tags: [gdpr, security, serverless, compliance, nodejs, netlify]
readTime: 8
image: "../media/img/blog/gdpr-document-collection-serverless.svg"
---

# Sensitive Candidate Data Without a Database: GDPR on Serverless

The requirement sounded simple: candidates register online, and the agency receives a complete registration pack. I [wrote about the overall architecture](serverless-recruitment-portal-3-months.html) of that project earlier; this post is about the part that kept me up at night.

Because look at what "register online" meant in practice. Name, address and date of birth. National Insurance number. Right-to-work share code. Bank details for payroll. A photo taken with the device camera. A handwritten signature. And a health questionnaire, which under GDPR is special category data, the kind with the strictest rules of all.

That's some of the most sensitive personal data a person has, going into a system built by one contractor, on a small budget, for a client with no compliance department. GDPR doesn't care that the team is one person. The obligations apply to everyone.

So compliance couldn't be a checklist applied at the end. It had to be the architecture.

## Data Minimization as a Design Constraint

GDPR's data minimization principle says you collect and keep only what you need, for only as long as you need it. Most projects treat that as a policy question. I treated it as a systems question, and it produced the most important decision of the project:

**The platform stores nothing.**

A submission goes through a single serverless function. It receives the form, builds a PDF with the candidate's details, photo and signature, emails it to the agency (the data controller, with an existing process for handling candidate data), emails the candidate a confirmation, and finishes. No database. No file storage bucket. When the function returns, the platform's copy of the data is gone.

The agency wanted it that way too: they didn't want candidate data sitting in a system they'd have to look after. So this wasn't me talking a client out of a feature. It was a constraint we agreed on early, and one I'd have argued for anyway.

**The ID documents never touch the platform at all.** This is the part people don't expect. Passports, licences, certificates: the confirmation email lists exactly which documents the candidate needs to send (the list changes with their employment type), and they reply to it with scans. Those files go straight into the agency's mailbox, where their existing process already handles them. My code never sees a passport. The cheapest document upload to secure is the one you don't build.

The compliance surface that removed is hard to overstate. Retention policies, encryption at rest, access control on stored files, breach notification for a stored dataset, right-to-erasure requests against my system: all of it collapses when there's no "at rest" to secure.

The trade-off is real: no admin dashboard, no "show me last month's candidates" on the platform side, and a document step that depends on the candidate replying to an email. The agency accepted that trade, and I'd rather add a missing feature later than explain a breach of a database that didn't need to exist.

## Where the Data Can Still Leak

Deciding not to store data is the easy part. The sneaky part is all the places data gets stored *accidentally*.

**The browser.** A long multi-step form that loses everything on a refresh is how you lose candidates, so the form keeps its progress in `sessionStorage`. That's storage, on the candidate's own device. I picked `sessionStorage` over `localStorage` on purpose: it dies with the tab, so a shared computer doesn't keep someone's NI number around for the next person. And the form clears it the moment the submission succeeds.

```ts
// Progress survives a refresh, not a closed tab.
sessionStorage.setItem("formStep", step.toString());
sessionStorage.setItem("formData", JSON.stringify(formState));

// ...and after a successful submit, nothing is left behind.
sessionStorage.removeItem("formStep");
sessionStorage.removeItem("formData");
```

**Function logs.** Logs live in the hosting platform's log retention, so one careless `console.log(body)` would quietly turn them into the database I'd designed away. The functions log which stage they're at and, on failure, the error message. Never the payload.

```ts
} catch (error) {
  // The error message goes to the log. The request body never does.
  // Logs are storage too.
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";
  console.error("Processing error:", errorMessage);
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ error: "Failed to process registration" }),
  };
}
```

**Email as a delivery channel.** The pack reaches the agency by email, which makes the agency's mailbox the system of record. That's the controller/processor split in practice: the platform processes in transit, the agency's mailbox and process handle custody. The mail goes out over SMTP credentials the agency sets in the environment, so they choose and contract their own email provider. The code works with any of them.

**Third-party services.** The hosting platform and the agency's email provider both see the data in transit, which makes them processors. That's the part I'd push harder on today, more on that below.

## Validation: What I Did, and What I'd Add

The form validates every step before you can move on: required fields, email format, share code and licence formats, bank details depending on employment type, the health questionnaire, employment history with any gaps explained, and a declaration date that can't be in the future. The photo has to be a real image, and under 2 MB.

That's good UX, and it stops incomplete registrations at the source. But here's my admission: all of it runs in the browser. The function checks that the form and the signature are there and trusts the rest. The client is supposed to be a suggestion and the server the law, and in this build I had it the wrong way round.

It hasn't caused a problem, and the blast radius is limited (the worst case is a malformed PDF in the agency's inbox, not a leak). But if I opened this codebase tomorrow, three things would go in first:

1. **Server-side validation with the same schema.** One schema shared by the form and the function, so the two sets of rules can't drift apart.
2. **A locked-down CORS origin.** The function currently answers requests from any origin. It should only answer the site's own.
3. **Error IDs instead of error messages.** Send the user an ID and log the details against it, so a support request can be matched to a log line without anything else crossing over.

```ts
// What I'd add: one schema, used in the browser AND in the function.
const personalDetails = z.object({
  email: z.string().email(),
  shareCode: z.string().regex(SHARE_CODE_PATTERN).optional(),
  photo: base64Image({ maxBytes: 2 * 1024 * 1024 }),
});

// In the function: parse, don't trust.
const parsed = registrationSchema.safeParse(body.formData);
if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
```

## What I'd Tell Another Solo Developer

If a small client asks you for "just a form" that collects personal data like this, the honest quote includes compliance thinking, and the cheapest compliance you'll ever buy is architectural: **don't hold the data.** Every pound of that project's tiny budget went further because there was no stored dataset demanding encryption, audits, and retention tooling.

That approach has limits. The moment the client needs querying, history, or workflows over past submissions, you're building storage, and then you owe them the real thing: encryption at rest, access control, retention automation, and a data map. The skill is knowing which project you're on before you start.

## Results

- Zero databases and zero file storage: nothing at rest on the platform to breach, encrypt, or purge
- ID documents never pass through the platform; they go straight from the candidate to the agency's mailbox
- One serverless function per form, no personal data in its logs, and a hosting bill of zero on a free tier
- Right-to-erasure and retention sit with the agency's existing process, which is where the data actually lives
- Sized honestly: it serves an agency working with somewhere between 10 and 20 drivers, which is exactly the scale where a no-storage design fits

## Lessons Learned

**Architecture is the strongest compliance tool you have.** Policies drift and checklists get skipped. A system that physically can't retain data doesn't need either to be right.

**Every sink is storage.** Logs, the browser, email, error trackers. I was careful with the logs and the browser. Next time I'd treat the hosting and email providers with the same suspicion, and write their data terms down before launch rather than after.

**Validate where it counts.** Client-side validation made the form pleasant. Only server-side validation makes it safe. I knew that rule and still shipped without it, which taught me that knowing a rule isn't the same as having a check that enforces it.

**Agree who the controller is.** Once the agency and I agreed that their mailbox and process were the system of record, a dozen fuzzy questions got crisp answers. Ambiguity about who holds the data is where small projects get hurt.

**When not to do this:** pass-through architecture fits intake pipelines with a responsible party on the other end. If the platform itself has to serve the data back out (portals, dashboards, ongoing candidate management), storing it properly is the honest scope, and this design would just be an abdication with extra steps.
