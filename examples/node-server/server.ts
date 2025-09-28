import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { autoMarkdown } from '../../src'

const app = new Hono()

app.use('*', autoMarkdown())

app.get('/', (c) =>
  c.html(`
    <main>
      <h1>Welcome to the Markdown demo</h1>
      <p>This page is served as HTML for browsers.</p>
      <p>Requests that look like AI agents receive a Markdown rendition.</p>
    </main>
  `),
)

app.get('/docs', (c) =>
  c.html(`
    <main>
      <h2>Endpoints</h2>
      <ul>
        <li><strong>GET /</strong> – Greeting page demonstrating Markdown conversion.</li>
        <li><strong>GET /docs</strong> – This very documentation list.</li>
        <li><strong>GET /status</strong> – JSON response that is left untouched.</li>
      </ul>
    </main>
  `),
)

app.get('/status', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = (() => {
  const { PORT } = process.env
  if (!PORT) return 8787
  const parsed = Number(PORT)
  return Number.isNaN(parsed) ? 8787 : parsed
})()

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`)
    console.log('Try curl with a Claude user agent to see Markdown:')
    console.log(`  curl -H 'User-Agent: Claude-User' http://localhost:${info.port}/`)
  },
)
