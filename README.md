<img width="3914" height="2193" alt="image" src="https://github.com/user-attachments/assets/a7a1a012-5faf-4874-abd0-8328d9b57172" />


# hono-auto-md

Hono middleware that converts HTML responses into Markdown when the incoming request is likely made by an AI agent. It relies on [`webforai`](https://www.npmjs.com/package/webforai) so language models receive content that is easier to consume while browsers keep getting HTML.

## Motivation

- Detect AI-oriented requests by inspecting headers without touching your existing handlers.
- Reuse the same HTML templates for humans while serving Markdown to crawlers and chat assistants.
- Add the behaviour as a single middleware that clones the downstream response and swaps in Markdown.

## Ultra Quick Start

Just install the package and add the middleware to your Hono app:

```bash
npm install hono hono-auto-md
```

Then:


```ts
import { Hono } from 'hono'
import { autoMarkdown } from 'hono-auto-md'

const app = new Hono()

app.use('*', autoMarkdown())

app.get('/', (c) =>
  c.html(`
    <main>
      <h1>Hello!</h1>
      <p>This page will be converted to Markdown for AI agents.</p>
    </main>
  `),
)

export default app
```

A regular browser hitting `/` receives HTML. When a caller with headers that look like Claude's code browser visits the same route, the response is converted to Markdown and the middleware adds `X-Hono-Auto-Md: TRUE`.

## Options

```ts
app.use('*', autoMarkdown({
  detect: [{ header: 'user-agent', includes: ['my-ai-client'] }],
  htmlToMarkdown: (html) => html,
  allowedContentTypes: ['text/html', 'application/xhtml+xml'],
  responseContentType: 'text/markdown; charset=utf-8',
}))
```

- `detect`: Either a custom `(request) => boolean | Promise<boolean>` or an array of `HeaderMatcher` objects (see below). When omitted, `CLAUDE_CODE_HEADER_MATCHER` is used.
- `htmlToMarkdown`: Pass options for `webforai`'s `htmlToMarkdown` (the middleware sets `baseUrl` automatically) or provide your own conversion function.
- `allowedContentTypes`: Only responses whose `Content-Type` matches one of these strings are converted. Defaults to `text/html` and `application/xhtml+xml`.
- `responseContentType`: Header value applied to converted responses. Defaults to `text/markdown; charset=utf-8`.

### Header matchers

A matcher is an object with a `header` plus optional `equals`, `includes`, and `matches` arrays. The middleware lowercases the header value before comparing.

```ts
import type { HeaderMatcher } from 'hono-auto-md'

const matchers: HeaderMatcher[] = [
  { header: 'user-agent', includes: ['claude-user'] },
  { header: 'x-custom-client', equals: ['bot'] },
]
```

Providing these matchers through the `detect` option makes the middleware convert responses whenever any matcher hits.

## Built-in helpers

The entry point re-exports the pieces you may want to use directly:

- `CLAUDE_CODE_HEADER_MATCHER`: Default array of matchers that recognises Claude's code browsing agent.
- `DEFAULT_CONTENT_TYPES`: The built-in allowlist for HTML-like responses.
- `MARKDOWN_CONTENT_TYPE`: The default Markdown content type string.
- `resolveBaseUrl(url: string)`: Helper that safely turns a request URL into an absolute base URL for `webforai`.

## Detection details

With no options the middleware uses `CLAUDE_CODE_HEADER_MATCHER`, which currently looks for `user-agent` values containing `Claude-User`. You can swap this out for your own heuristics or an explicit detection function. Responses that already declare a Markdown content type are skipped.

## Development

```bash
npm install
npm run build
npm run test
```

Tests run on [Vitest](https://vitest.dev/). The compiled output lives in `dist/` and is published automatically by npm's default files list.
