import { existsSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { query } from './db.js'
import { authenticate } from './lib/auth.js'
import { errorHandler, notFound } from './lib/http.js'
import { auditRouter, rolesRouter, usersRouter } from './routes/admin.js'
import authRouter from './routes/auth.js'
import gatePassRouter from './routes/gatePasses.js'
import { dashboardRouter, notificationsRouter, reportsRouter } from './routes/insights.js'
import mastersRouter from './routes/masters.js'
import { publicRouter as publicVisitorRouter, router as visitorRouter } from './routes/visitors.js'
import weighbridgeRouter from './routes/weighbridge.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1) // behind Nginx in production
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Content-Disposition', 'X-Dev-Reset-Link'] }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', async (_req, res) => {
    await query('SELECT 1')
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  const v1 = express.Router()
  v1.use('/auth', authRouter)
  v1.use('/public', publicVisitorRouter)
  v1.use(authenticate)
  v1.use('/gate-passes', gatePassRouter)
  v1.use('/visitors', visitorRouter)
  v1.use('/weighbridge', weighbridgeRouter)
  v1.use('/masters', mastersRouter)
  v1.use('/users', usersRouter)
  v1.use('/roles', rolesRouter)
  v1.use('/audit', auditRouter)
  v1.use('/dashboard', dashboardRouter)
  v1.use('/reports', reportsRouter)
  v1.use('/notifications', notificationsRouter)
  app.use('/api/v1', v1)
  app.use('/api', (_req, _res, next) => next(notFound('API route not found')))

  // Optional single-server deployment: serve the built frontend from the same origin.
  const dist = path.resolve(process.env.FRONTEND_DIST || '../frontend/dist')
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: '1h', index: false }))
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  app.use(errorHandler)
  return app
}
