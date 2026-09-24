---
title: "Signing In to GitHub From a PWA With a 117-Line Cloudflare Worker"
date: "2026-09-15"
excerpt: "GitHub's device-flow endpoints send no CORS headers, so a PWA can't sign in. How a tiny Cloudflare Worker, with two paths and zero secrets, gets around it."
tags: [cloudflare-workers, oauth, security, typescript, pwa, backend]
readTime: 8
image: "../media/img/blog/github-device-flow-cloudflare-worker.svg"
---

# Signing In to GitHub From a PWA With a 117-Line Cloudflare Worker

VS Code Todo is a todo and notes extension with over 9,000 installs across the VS Code Marketplace and Open VSX. Its lists can already sync through a secret GitHub Gist. Its companion app, a PWA called [Plans](https://plans-app.pages.dev), opens the same lists on a phone.

One constraint shaped everything: no application server. The extension and the PWA are peers that read and write the same gist, and the only thing I wanted to host was static files. That plan survived right up until sign-in, where the browser said no.

This post is about the smallest backend I've written that still needed real security thinking: a Cloudflare Worker of 117 lines, with no secrets, no state, and exactly two allowed paths.

## Why the Device Flow

Both apps need a GitHub token with the `gist` scope. The extension gets one almost for free: VS Code has a built-in GitHub authentication provider, and the token lives in VS Code's SecretStorage.

A PWA has no such luxury. Everything shipped to a browser is public, so it can't hold a client secret, and the usual redirect-based flow for a GitHub OAuth App expects a secret when it exchanges the code for a token. That means a server whose only job is holding a secret, which is exactly what I was trying to avoid.

The OAuth 2.0 Device Authorization Grant (RFC 8628) fits much better. It's the flow you've seen on smart TVs: the app shows a short code, you type it on github.com, and the app polls until GitHub hands over a token. It only needs the app's public `client_id`. No secret anywhere.

The polling loop is where the protocol details live. Simplified from the real `deviceFlow.ts`:

```ts
// GitHub device codes expire after about 15 minutes, so that's the hard cap.
const deadline = Date.now() + 15 * 60 * 1000;
await sleep(intervalMs); // give the user time to type the code first

while (Date.now() < deadline) {
  const data = await requestAccessToken(deviceCode);
  if (data.access_token) return data.access_token;

  switch (data.error) {
    case "authorization_pending": break;         // not yet, keep waiting
    case "slow_down": intervalMs += 5000; break; // the spec says: add 5 seconds
    case "expired_token": throw new DeviceFlowError("The device code expired.", "expired_token");
    case "access_denied": throw new DeviceFlowError("Authorization was denied.", "access_denied");
  }
  await sleep(intervalMs);
}
```

`slow_down` is the one that's easy to miss. RFC 8628 says the client must add five seconds to its interval for that request and every one after it. Ignore it and you're the client that keeps hammering an auth server that asked you to stop.

## The Catch: github.com Sends No CORS Headers

Here's where it stopped working. The device-flow endpoints live on `github.com`, not `api.github.com`, and they don't send CORS headers. From a server that doesn't matter. From a browser, the request goes out, but the page isn't allowed to read the response. No code, no token.

`api.github.com` is different: it does allow CORS. So the gist traffic was never the problem. Only two requests were: asking for a device code, and polling for the token.

So the backend I needed wasn't an auth server. It was a CORS shim for exactly two URLs.

## The Worker

The whole thing is one file with zero runtime dependencies, and the design is mostly a list of things it refuses to do:

```ts
const GITHUB_BASE = "https://github.com";
// The only two requests a browser can't make itself. Everything else is refused,
// so this can never turn into an open proxy.
const ALLOWED_PATHS = new Set(["/login/device/code", "/login/oauth/access_token"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allowOrigin = resolveAllowedOrigin(env, request.headers.get("Origin"));

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, allowOrigin);
    }
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return json({ error: "not_found" }, 404, allowOrigin);
    }
    // ...forward the body to github.com and hand back GitHub's status and body
    // with CORS headers added. If GitHub can't be reached, answer 502.
  },
};
```

The controls, in the order a request meets them:

- **Methods.** `OPTIONS` gets a 204 preflight answer that browsers can cache for a day (`Access-Control-Max-Age: 86400`). `POST` goes on. Anything else is a 405.
- **Paths.** Exactly two. Everything else is a 404. This is the line that matters most: a proxy that forwards "anything under github.com" is a gift to whoever finds it first.
- **Origins.** `ALLOWED_ORIGINS` is set to the PWA's production domain, and the Worker answers with `Vary: Origin` so caches never mix up responses for different origins.
- **Client id.** If `CLIENT_ID` is configured, a request carrying a different `client_id` gets a 403, so the Worker only serves my OAuth app.
- **Upstream failure.** If GitHub can't be reached, the PWA gets a clean 502 `upstream_unreachable` instead of a hanging request. GitHub's own status codes pass straight through.

**Why there are no secrets.** The device flow only uses the public `client_id`, so the Worker has nothing to protect and nothing to leak. It doesn't store anything either. That's the strongest property of this design: the worst bug a proxy can have is leaking a credential, and this one doesn't have a credential to leak.

**What it deliberately doesn't do.** It doesn't proxy gist reads and writes. Since `api.github.com` allows CORS, the PWA talks to it directly with the token. Routing that traffic through the Worker would have added latency, a bill, and one more place for tokens to pass through, for no benefit at all.

## What I Got Wrong, or Left Open

This is the section an interviewer should poke at, so here it is up front.

**The origin allowlist is CORS, not access control.** It's tempting to read the allowlist as "only my PWA can use this". That's wrong. CORS is enforced by browsers: a request from another origin still reaches the Worker and still gets forwarded. The browser just won't let that page read the answer. And a client that sends no `Origin` at all, like `curl`, gets `*`. In practice that's acceptable here, because the Worker only forwards two public GitHub endpoints that anyone can call from a server anyway. But it's worth being precise about what the allowlist actually protects: users' browsers, not the endpoint.

**Client id pinning isn't switched on yet.** The `CLIENT_ID` check is in the code, but the line that sets it is still commented out in `wrangler.toml`. Until it's on, the Worker would run the device flow for somebody else's OAuth app too. It's a one-line change, and it should be made.

**Preview deployments can't sign in.** Cloudflare Pages gives every deployment its own `<hash>.plans-app.pages.dev` origin, which isn't on the allowlist. So sign-in only works on the production domain. That's the price of not opening the allowlist up with a wildcard.

**The token lives in IndexedDB, in plaintext.** Any script running on the PWA's origin could read it. The mitigations are the narrow `gist` scope and an explicit Disconnect. But Disconnect doesn't revoke the token on GitHub, and `gist` still covers every gist in the account. For a single-user tool that's a trade-off I can defend. For anything multi-user it wouldn't be.

## The Numbers

- 117 lines of TypeScript in one file, with zero runtime dependencies
- 2 forwarded paths; every other path gets a 404
- 0 secrets held and 0 bytes of state stored
- A 15-minute hard cap on polling, with 5 seconds added to the interval on every `slow_down`
- 1 day of preflight caching, so a browser doesn't repeat the `OPTIONS` round trip on every poll

## Trade-offs

A Worker is one more thing to deploy. The extension ships to two registries, the PWA to Cloudflare Pages, and now the Worker to Cloudflare Workers, each with its own command. For two HTTP requests, that's a real cost. If GitHub ever adds CORS headers to the device-flow endpoints, the right move is to delete the Worker entirely.

The heavier alternative is a proper auth backend: server-side sign-in, a session in an httpOnly cookie, and no token in the browser at all. That removes both the plaintext token and the proxy, and it's where this goes if the app ever supports sharing lists between people. But it's a server to run, patch and secure, for a free single-user tool. Not yet.

## Lessons Learned

**Find the smallest thing that's actually blocked.** "The browser can't sign in" sounded like "I need an auth server". It turned out to be two URLs without CORS headers. The size of the backend followed from that, not from habit.

**Design a proxy around what it refuses.** Two paths, one method, a known origin. The allowlists do more for security than any clever code would.

**Know what each control actually protects.** CORS protects users in their browsers. It doesn't protect your endpoint. Mixing those two up is how people end up running open proxies they believe are locked down.

**When not to do this:** if the provider already sends CORS headers on its token endpoints, or your flow needs a client secret, a CORS shim is the wrong tool. And the moment you need sessions, revocation or more than one user, you need a real backend.

The Worker's code is in the [vscode-todo repository](https://github.com/ai-autocoder/vscode-todo/tree/master/worker).
