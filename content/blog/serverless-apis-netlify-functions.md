---
title: "Building Serverless APIs with Netlify Functions and Node.js"
date: "2024-12-13"
excerpt: "Learn how to build production-ready serverless APIs with Netlify Functions, from form handling to PDF generation, including the trade-offs and gotchas."
tags: [serverless, netlify, nodejs, backend, api]
readTime: 7
---

# Building Serverless APIs with Netlify Functions and Node.js

For a recent project, I had to make a choice: spin up a traditional server or go serverless. I chose serverless, and here's why it worked out (and where it didn't).

## Why Serverless? (The Honest Reasons)

Let me skip the marketing speak about "infinite scalability" and give you the real reasons:

1. **Budget**: The budget for hosting was minimal. Netlify's free tier was perfect.
2. **Speed**: I needed to ship in 6 weeks, not set up infrastructure.
3. **Simplicity**: Frontend and backend in the same repo, deployed together.

Would I use serverless for a high-traffic API? Probably not. But for a site with moderate traffic? Perfect fit.

## The Project Requirements

The requirements were straightforward:
- Multi-step form for applications
- Collect documents, photos, signatures
- Generate PDF of the application
- Email it to the recipient
- Send confirmation email to applicant

This needed a backend, but not a complicated one.

## Setting Up Netlify Functions

### Project Structure

```
project/
├── netlify/
│   └── functions/
│       ├── submit-application.js
│       ├── generate-pdf.js
│       └── send-email.js
├── public/
├── src/
└── netlify.toml
```

### Configuration (netlify.toml)

```toml
[build]
  functions = "netlify/functions"
  publish = "dist"

[functions]
  node_bundler = "esbuild"
```

That's it. Netlify automatically finds and builds your functions.

### Your First Function

```javascript
// netlify/functions/hello.js
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello World' })
  };
};
```

Deploy it, and it's available at `/.netlify/functions/hello`.

Simple, right? That's the beautiful part.

## Real Example: Handling Form Submissions

Here's the actual function that handles job applications:

```javascript
// netlify/functions/submit-application.js
const { sendEmail } = require('./utils/email');
const { generatePDF } = require('./utils/pdf');
const { validateApplication } = require('./utils/validation');

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const application = JSON.parse(event.body);

    // Validate the application data
    const errors = validateApplication(application);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ errors })
      };
    }

    // Generate PDF from application data
    const pdfBuffer = await generatePDF(application);

    // Send email to agency with PDF attachment
    await sendEmail({
      to: 'recruitment@example.com',
      subject: `New Application: ${application.fullName}`,
      body: generateEmailBody(application),
      attachments: [{
        filename: `application-${application.fullName}.pdf`,
        content: pdfBuffer
      }]
    });

    // Send confirmation email to applicant
    await sendEmail({
      to: application.email,
      subject: 'Application Received',
      body: 'Thank you for your application...'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Application submitted successfully'
      })
    };

  } catch (error) {
    console.error('Error processing application:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process application'
      })
    };
  }
};
```

## The PDF Generation Challenge

This was trickier than I expected. Serverless functions have limitations:
- 50MB size limit (including dependencies)
- 10-second timeout on free tier
- No persistent file system

### Attempt 1: Puppeteer (Failed)

My first try was Puppeteer to generate PDFs from HTML:

```javascript
const puppeteer = require('puppeteer');

async function generatePDF(data) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(generateHTML(data));
  const pdf = await page.pdf();
  await browser.close();
  return pdf;
}
```

Problem: Puppeteer + Chrome = 150MB. Way over the 50MB limit.

### Attempt 2: PDFKit (Success)

I switched to PDFKit, a lightweight PDF library:

```javascript
const PDFDocument = require('pdfkit');

async function generatePDF(application) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add content to PDF
    doc.fontSize(20).text('Job Application', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Name: ${application.fullName}`);
    doc.text(`Email: ${application.email}`);
    doc.text(`Phone: ${application.phone}`);
    doc.moveDown();

    doc.text('Experience:', { underline: true });
    doc.text(application.experience);
    doc.moveDown();

    // Add images if provided
    if (application.photoId) {
      const imageBuffer = Buffer.from(application.photoId, 'base64');
      doc.image(imageBuffer, { width: 200 });
    }

    doc.end();
  });
}
```

This worked. Package size: 8MB. Execution time: 2 seconds. Perfect.

## Handling File Uploads

Users needed to upload documents and photos. But serverless functions don't have file systems.

### The Solution: Base64 Encoding

Frontend converts files to base64:

```javascript
// In React component
const handleFileUpload = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onloadend = () => {
    const base64String = reader.result;
    setFormData({
      ...formData,
      photoId: base64String
    });
  };

  reader.readAsDataURL(file);
};
```

Backend receives base64, converts back to buffer:

```javascript
const imageBuffer = Buffer.from(photoId.split(',')[1], 'base64');
```

Is this efficient? Not really. But it works, and for our use case (a few images per application), it's fine.

## Sending Emails

I used SendGrid for emails:

```javascript
// netlify/functions/utils/email.js
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail({ to, subject, body, attachments = [] }) {
  const msg = {
    to,
    from: 'noreply@example.com',
    subject,
    html: body,
    attachments: attachments.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
      type: 'application/pdf',
      disposition: 'attachment'
    }))
  };

  await sgMail.send(msg);
}

module.exports = { sendEmail };
```

SendGrid's free tier allows 100 emails/day. More than enough for our needs.

## Environment Variables

Never hardcode API keys. Use environment variables:

```javascript
// In your function
const apiKey = process.env.SENDGRID_API_KEY;

// In Netlify dashboard: Site settings > Environment variables
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

For local development, use `.env`:

```bash
# .env (add to .gitignore!)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

And `netlify dev` automatically loads them.

## Local Development

The `netlify dev` command is a game-changer:

```bash
npm install netlify-cli -g
netlify dev
```

This runs:
- Your frontend dev server
- Your functions locally
- With environment variables loaded

You can test everything locally before deploying.

## CORS: The Annoying But Necessary Part

If your frontend and functions are on different domains, you need CORS headers:

```javascript
exports.handler = async (event, context) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Your actual function logic
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Hello' })
  };
};
```

For same-domain (which Netlify does by default), you don't need this. But I always add it anyway because I inevitably test from localhost.

## Error Handling and Logging

Serverless functions can fail silently. Good logging is essential:

```javascript
exports.handler = async (event, context) => {
  console.log('Function invoked:', {
    method: event.httpMethod,
    path: event.path,
    timestamp: new Date().toISOString()
  });

  try {
    // Function logic
    const result = await processApplication(data);

    console.log('Success:', { result });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};
```

Netlify captures all console.log output. You can view it in the Functions log.

## The Deployment Experience

One of the best parts of Netlify Functions: deployment is automatic.

1. Push to GitHub
2. Netlify detects the change
3. Builds and deploys everything
4. Functions are live

No servers to SSH into. No Docker containers. No kubernetes clusters. Just git push.

For this project, every commit to `main` is in production within 2 minutes.

## What I Love About Serverless

### 1. Zero Maintenance
No servers to patch, no uptime to monitor. It just works.

### 2. Cost-Effective
We process maybe 50 applications per month. On traditional hosting, we'd pay £10-20/month for a server that's idle 99% of the time. With Netlify Functions: £0.

### 3. Automatic Scaling
Had a spike when the site got featured on a job board. 200 applications in one day. I didn't have to do anything. It just handled it.

### 4. Simple CI/CD
Frontend and backend deployed together. No coordination needed.

## What I Don't Love About Serverless

### 1. Cold Starts
First request after inactivity can take 1-2 seconds. Not great for user experience. We mitigated this with a loading spinner and good messaging.

### 2. Debugging is Harder
No SSH access. No direct database access. You're debugging through logs.

### 3. Vendor Lock-In
This code is pretty specific to Netlify. Migrating to AWS Lambda would require changes.

### 4. Function Size Limits
50MB seems like a lot until you need Puppeteer or Sharp or some other heavy library.

## When to Use Serverless

**Good fit:**
- Low to medium traffic
- Predictable, simple workloads
- Want to ship fast
- Limited budget
- Prefer simplicity over control

**Bad fit:**
- High traffic (cold starts become a problem)
- Need sub-100ms response times
- Complex background jobs
- Large file processing
- Need fine-grained control over infrastructure

For this recruitment platform, it was the perfect fit. For a high-traffic API, I'd probably use traditional hosting.

## The Results

The platform has been running for 6 months:
- Processed 300+ submissions
- Zero downtime
- Zero hosting costs
- 2-second average response time

More importantly: it took 6 weeks to build and I haven't had to touch the infrastructure since.

## Your Turn

If you're building a small to medium-scale backend, give Netlify Functions a try:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Initialize a new project
netlify init

# Create a function
mkdir -p netlify/functions
echo "exports.handler = async () => ({ statusCode: 200, body: 'Hello' })" > netlify/functions/hello.js

# Test locally
netlify dev

# Deploy
netlify deploy --prod
```

That's it. You now have a live API endpoint.

Serverless isn't perfect, but for the right use case, it's ridiculously productive.

---

*Using serverless? Or sticking with traditional servers? I'd love to hear your experience. Find me on LinkedIn.*
