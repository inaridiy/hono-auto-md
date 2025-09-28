# Hono Node Server Example

This example spins up a local server with `@hono/node-server` and the `autoMarkdown` middleware from this repository.

## Run the example

Start the server with:

```bash
pnpx tsx examples/node-server/server.ts 
```

The server listens on [http://localhost:8787](http://localhost:8787).

- Visiting `/` with a regular browser returns the HTML template.
- Hitting `/` or `/docs` with an AI-style user agent such as Claude triggers Markdown conversion. Try:

  ```bash
  curl -H 'User-Agent: Claude-User' http://localhost:8787/
  ```

You can inspect the `X-Hono-Auto-Md` response header to confirm that the middleware ran. The `/status` path returns JSON and bypasses the conversion.

Stop the server with `Ctrl+C`.
