# hono-auto-md

Hono middleware that turns HTML responses into Markdown when the incoming request is likely made by an AI agent. It uses [`webforai`](https://www.npmjs.com/package/webforai) under the hood so large language models receive content that is easier to consume.

## Motivation

Many AI clients (ChatGPT browsing, Claude projects, etc.) prefer Markdown. Instead of rewriting handlers you can mount a single middleware that:

- Detects requests that look like they originated from an LLM by checking HTTP headers.
- Lets your normal route handlers keep producing HTML for browsers.
- Converts the HTML into Markdown via `webforai` and updates the response headers accordingly.
- Falls back to the original HTML if conversion fails.

## Installation

```bash
npm install hono hono-auto-md webforai
```

The package declares `hono` as a peer dependency to avoid bundling multiple copies.

## Quick start

```ts
import { Hono } from 'hono'
import autoMarkdown from 'hono-auto-md'

type Bindings = {}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', autoMarkdown())

app.get('/', (c) => {
  return c.html(`
    <main>
      <h1>Hello!</h1>
      <p>This page will be converted to Markdown for AI agents.</p>
    </main>
  `)
})

export default app
```

If a browser hits `/`, the user receives HTML. If an AI crawler with a matching `User-Agent` (e.g. "ChatGPT" or "Claude") hits the same endpoint, it gets a Markdown version instead.

## Options

```ts
app.use('*', autoMarkdown({
  detect: (request) => request.headers.get('x-my-ai-proxy') === '1',
  headerMatchers: [
    { header: 'user-agent', includes: ['my-bespoke-agent'] }
  ],
  allowedContentTypes: ['text/html'],
  responseContentType: 'text/markdown; charset=utf-8',
  onDetectError: (error) => console.error('Detection failed', error),
  onConvertError: (error) => console.error('Conversion failed', error)
}))
```

- `detect`: Provide your own detection logic. When present, header matchers are ignored.
- `headerMatchers`: Additional heuristics for the built-in detector. Each matcher looks for headers that contain/equals/match a pattern. When omitted, a sensible list of common LLM headers is used.
- `allowedContentTypes`: Only responses with a matching `Content-Type` are converted. Defaults to `text/html` and `application/xhtml+xml`.
- `responseContentType`: Content-Type for the Markdown response. Defaults to `text/markdown; charset=utf-8`.
- `onDetectError` / `onConvertError`: Optional callbacks if detection or conversion throws.

## How detection works

The default detector checks the following headers (case-insensitive) and looks for substrings such as `gpt`, `chatgpt`, `claude`, and `anthropic`:

- `User-Agent`
- `X-OpenAI-Host`
- `X-AI-Client`
- `X-Stainless-Runtime`

If any matcher hits, the middleware assumes the caller is an AI and converts the downstream HTML response to Markdown. You can extend or replace this detection entirely.

## Notes

- The middleware skips conversion when the response is already Markdown (`text/markdown`).
- The response gains an `X-Hono-Auto-Md: 1` header so you can debug easily.
- Conversion uses `Response.clone()` to avoid consuming the original stream until it is needed.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript before publishing
npm run build

# Run tests
npm run test
```

Tests use [Vitest](https://vitest.dev/).

The compiled output lives in `dist/` and is included automatically when you publish to npm.
