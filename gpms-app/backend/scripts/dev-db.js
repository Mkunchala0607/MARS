// Development-only PostgreSQL (PGlite, embedded) for machines without a Postgres login.
// Data persists in ./.devdb. Production and UAT must use a real PostgreSQL server.
import net from 'node:net'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const port = Number(process.env.DEV_DB_PORT || 5499)

// Check the port before opening the data folder: two processes must never open ./.devdb at once.
const portFree = await new Promise((resolve) => {
  const probe = net.createServer().once('error', () => resolve(false)).once('listening', () => probe.close(() => resolve(true)))
  probe.listen(port, '127.0.0.1')
})
if (!portFree) {
  console.error(`Port ${port} is already in use - the dev database is probably already running in another terminal.`)
  console.error('Use that one, or close it first (Ctrl+C in its terminal) and run this again.')
  process.exit(1)
}

const db = await PGlite.create('./.devdb')
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
console.log(`Dev PostgreSQL (PGlite) on postgres://postgres:postgres@127.0.0.1:${port}/postgres - set DB_POOL_MAX=1`)

const stop = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
