---
title: "Building Custom Developer Tools with MCP Servers"
date: "2025-11-15"
excerpt: "AI assistants are powerful, but they don't know your codebase, your deployment process, or your team's conventions. Here's how I built custom MCP servers to bridge that gap and make Claude actually useful for our specific workflow."
tags: [mcp, ai, claude, developer-tools, typescript, automation]
readTime: 14
---

# Building Custom Developer Tools with MCP Servers

Claude is smart. But it doesn't know that our API responses follow a specific format. It doesn't know our deployment requires three approvals. It doesn't know we have a shared component library with 47 reusable components.

Every time I asked Claude for help, I had to explain the same context. Over and over.

Then I discovered MCP servers. Now Claude knows everything about our codebase, and I stopped repeating myself.

## What is MCP? (The Short Version)

MCP (Model Context Protocol) is a standard that lets AI assistants like Claude connect to external tools and data sources. Think of it as building plugins for your AI.

Instead of copy-pasting documentation into every prompt, you build a server that Claude can query directly.

**Before MCP**:
```
Me: "How do I add a new API endpoint?"
Claude: "Here's a generic Express example..."
Me: "No, we use FastAPI with our custom BaseResponse class and..."
*pastes 200 lines of context*
```

**After MCP**:
```
Me: "How do I add a new API endpoint?"
Claude: *queries my MCP server, gets our patterns*
Claude: "Based on your codebase, here's how to add an endpoint using your BaseResponse class..."
```

The difference is night and day.

## My First MCP Server: Documentation Search

I started simple. We had internal documentation scattered across Notion, markdown files, and code comments. Finding anything was painful.

Here's the basic structure of an MCP server:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "docs-search",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define what tools this server provides
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_docs",
        description: "Search internal documentation for a topic",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_docs") {
    const query = request.params.arguments?.query as string;
    const results = await searchDocumentation(query);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```

The `searchDocumentation` function was simple at first - just grep through markdown files. But it worked.

**Result**: Instead of searching three different places for documentation, Claude would find it for me. Time saved per day: roughly 30 minutes.

## Adding Context: The Codebase Analyzer

Documentation search was useful, but I wanted more. I wanted Claude to understand our code patterns.

I built a second tool that analyzes our codebase:

```typescript
{
  name: "get_code_patterns",
  description: "Get examples of how we implement specific patterns in our codebase",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        enum: ["api-endpoint", "react-component", "database-query", "error-handling", "authentication"],
        description: "The pattern to get examples for",
      },
    },
    required: ["pattern"],
  },
}
```

The handler returns actual code from our codebase:

```typescript
async function getCodePattern(pattern: string): Promise<string> {
  const patterns: Record<string, string> = {
    "api-endpoint": await readFile("./examples/api-endpoint.py"),
    "react-component": await readFile("./examples/component.tsx"),
    "database-query": await readFile("./examples/queries.py"),
    // ... more patterns
  };

  return patterns[pattern] || "Pattern not found";
}
```

I curated these examples from our actual codebase. The best, most representative examples of each pattern.

**The impact**: When I ask Claude to write a new component, it follows our conventions. No more "that's not how we do it here" during code review.

## The Deployment Helper: Where It Gets Interesting

Here's where MCP servers become powerful. I built a tool that knows our deployment process:

```typescript
{
  name: "check_deploy_status",
  description: "Check the current deployment status and any blockers",
  inputSchema: {
    type: "object",
    properties: {
      environment: {
        type: "string",
        enum: ["staging", "production"],
      },
    },
    required: ["environment"],
  },
}
```

This tool queries our CI/CD system and returns:
- Current deployment status
- Any failing tests
- Pending approvals
- Recent deployments and their status

```typescript
async function checkDeployStatus(environment: string) {
  const [pipelineStatus, pendingApprovals, recentDeploys] = await Promise.all([
    fetchPipelineStatus(environment),
    fetchPendingApprovals(environment),
    fetchRecentDeploys(environment, 5),
  ]);

  return {
    environment,
    pipeline: pipelineStatus,
    blockers: pendingApprovals.filter(a => a.required),
    recentDeploys: recentDeploys.map(d => ({
      version: d.version,
      timestamp: d.timestamp,
      status: d.status,
    })),
  };
}
```

Now when I ask "Can I deploy to production?", Claude doesn't give generic advice. It checks our actual pipeline and tells me exactly what's blocking the deploy.

## Configuration: Connecting Claude to Your Server

Once you've built your server, you need to tell Claude about it. For Claude Code, add it to your configuration:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

For Claude Desktop, the config goes in:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

The server starts automatically when Claude launches. No manual steps needed.

## Lessons Learned: What Actually Works

After building five different MCP tools, here's what I've learned:

### 1. Start With Read-Only Tools

My first attempt included a tool that could modify files. Bad idea. I accidentally overwrote a config file and spent an hour recovering.

Start with tools that only read data. Once you trust the system, add write capabilities with explicit confirmation steps.

### 2. Return Structured Data

Early versions returned plain text. But Claude works better with structured data:

```typescript
// Bad: returns plain text
return "Found 3 components: Button, Card, Modal";

// Good: returns structured data
return {
  count: 3,
  components: [
    { name: "Button", path: "src/components/Button.tsx", props: ["variant", "size", "onClick"] },
    { name: "Card", path: "src/components/Card.tsx", props: ["title", "children"] },
    { name: "Modal", path: "src/components/Modal.tsx", props: ["isOpen", "onClose", "children"] },
  ],
};
```

Claude can reason about structured data much better than parsing text.

### 3. Include Metadata

Always include context about when data was fetched:

```typescript
return {
  data: results,
  metadata: {
    fetchedAt: new Date().toISOString(),
    source: "production-api",
    cacheStatus: "fresh",
  },
};
```

This helps Claude (and you) understand if the information might be stale.

### 4. Error Handling Matters

When a tool fails, return useful error messages:

```typescript
try {
  const result = await fetchData();
  return { success: true, data: result };
} catch (error) {
  return {
    success: false,
    error: {
      message: error.message,
      suggestion: "Check if the API server is running",
      docs: "https://internal-docs/troubleshooting#api-connection",
    },
  };
}
```

Claude can then help troubleshoot instead of just saying "something went wrong."

## The Productivity Impact

After three months of using custom MCP servers:

- **Context switching dropped significantly**: I stopped jumping between documentation, CI dashboard, and code
- **Onboarding got easier**: New team members could ask Claude about our patterns and get accurate answers
- **Code review friction decreased**: Generated code followed our conventions from the start

The initial investment was maybe 8 hours of building tools. The return has been substantial.

## Should You Build MCP Servers?

Not every team needs custom MCP servers. Ask yourself:

1. **Do you have internal tools or documentation?** If everything is public and standard, MCP adds less value.
2. **Do you repeat context in prompts?** If you're constantly explaining the same things to AI, that's a sign.
3. **Is your workflow complex?** Multi-step processes like deployments benefit most from custom tools.

If you answered yes to any of these, start with one simple tool. A documentation search. A pattern library. Something small.

## Getting Started: Your First Server

Here's a minimal template to start with:

```typescript
// index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-first-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hello",
      description: "A simple test tool",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name to greet" },
        },
        required: ["name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "hello") {
    const name = request.params.arguments?.name as string;
    return {
      content: [{ type: "text", text: `Hello, ${name}! Your MCP server is working.` }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP server running");
```

Install dependencies:
```bash
npm init -y
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node
```

Build and test:
```bash
npx tsc index.ts --outDir dist --module nodenext --moduleResolution nodenext
node dist/index.js
```

From there, add the tools your workflow actually needs.

## What's Next

MCP is still evolving. The protocol is gaining adoption, and more tools are becoming available. But the real power isn't in pre-built tools - it's in building exactly what your team needs.

Start small. One tool that solves one annoyance. Then iterate.

The future of AI-assisted development isn't just about smarter models. It's about connecting those models to your specific context. MCP makes that possible.

And honestly? Building these tools is fun. It's like giving your AI assistant superpowers tailored to exactly how you work.
