// Development-only embedded PostgreSQL.
// Run from the backend folder. Data persists in ./.devdb.

import net from 'node:net'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const host = '127.0.0.1'
const port = Number(process.env.DEV_DB_PORT || 5499)

// Check the port before opening the database folder.
const portFree = await new Promise((resolve) => {
  const probe = net.createServer()

  probe.once('error', () => resolve(false))
  probe.once('listening', () => {
    probe.close(() => resolve(true))
  })

  probe.listen(port, host)
})

if (!portFree) {
  console.error(`Port ${port} is already in use.`)
  console.error(
    'Stop the existing database process before starting this script.',
  )
  process.exit(1)
}

console.log('Opening existing database: ./.devdb')

const db = await PGlite.create('./.devdb')

const server = new PGLiteSocketServer({
  db,
  port,
  host,
  inspect: true,
})

await server.start()

console.log(`[PGlite] Listening on ${host}:${port}`)
console.log('[PGlite] Diagnostic inspection requested')
console.log('[PGlite] Keep this terminal open. Press Ctrl+C to stop.')

let stopping = false

async function stop() {
  if (stopping) return
  stopping = true

  console.log('\n[PGlite] Shutting down...')

  try {
    await server.stop()
    await db.close()
    console.log('[PGlite] Database closed')
    process.exit(0)
  } catch (err) {
    console.error('[PGlite] Shutdown failed:', err)
    process.exit(1)
  }
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)