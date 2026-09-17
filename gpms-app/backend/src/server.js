import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db.js'
import { migrate } from './migrate.js'

// Apply any pending migrations on boot so a deploy is a single step.
await migrate()

const server = createApp().listen(config.port, () => console.log(`GPMS API listening on http://localhost:${config.port} (${config.env})`))

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
