import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

/**
 * Starts a fresh in-memory PostgreSQL (PGlite) on a random port, migrates and seeds it,
 * and returns a supertest agent against the app. PGlite serves one connection, so the pool is size 1.
 */
export async function startTestApp() {
  const port = 20000 + Math.floor(Math.random() * 20000)
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
  process.env.DB_POOL_MAX = '1'

  const db = await PGlite.create()
  const socket = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
  await socket.start()

  const { migrate } = await import('../src/migrate.js')
  const { tx, pool } = await import('../src/db.js')
  const { seedReference, seedDemo, createUser } = await import('../src/seed.js')
  const { createApp } = await import('../src/app.js')
  const supertest = (await import('supertest')).default

  await migrate({ log: () => {} })
  await tx(async (c) => {
    await seedReference(c)
    await createUser(c, { name: 'Super Admin', email: 'admin@gpms.local', password: 'Admin@12345', role: 'admin', department: 'IT' })
    await seedDemo(c, 'Demo@12345')
  })

  const app = createApp()
  const api = supertest(app)

  const login = async (email, password = 'Demo@12345') => {
    const res = await api.post('/api/v1/auth/login').send({ email, password })
    if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`)
    const auth = { Authorization: `Bearer ${res.body.token}` }
    return {
      user: res.body.user,
      get: (url) => api.get(url).set(auth),
      post: (url, body) => api.post(url).set(auth).send(body),
      put: (url, body) => api.put(url).set(auth).send(body),
      patch: (url, body) => api.patch(url).set(auth).send(body),
      del: (url, body) => api.delete(url).set(auth).send(body),
    }
  }

  const stop = async () => {
    await pool.end()
    await socket.stop()
    await db.close()
  }

  return { api, login, stop, pool }
}

export const futureDate = (days = 10) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
