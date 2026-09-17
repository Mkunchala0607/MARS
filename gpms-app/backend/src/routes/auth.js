import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { one, query, tx } from '../db.js'
import { authenticate, signToken } from '../lib/auth.js'
import { sendEmails } from '../lib/events.js'
import { badRequest, conflict, unauthorized, parse } from '../lib/http.js'
import { optText, passwordSchema, z } from '../lib/validators.js'

const router = Router()
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.env === 'test' ? 1000 : 20, standardHeaders: 'draft-8', legacyHeaders: false })
const hashToken = (t) => createHash('sha256').update(t).digest('hex')

export async function profile(userId) {
  const u = await one(
    `SELECT u.id, u.name, u.email, u.department, u.phone, u.vendor_id, r.code AS role, r.name AS role_name,
            (SELECT array_agg(screen_code ORDER BY screen_code) FROM role_permissions WHERE role_id = r.id) AS permissions
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [userId],
  )
  return { id: u.id, name: u.name, email: u.email, department: u.department, phone: u.phone, vendorId: u.vendor_id, role: u.role, roleName: u.role_name, permissions: u.permissions || [] }
}

/** Creates a single-use, 1-hour reset token and returns the link. */
export async function createResetLink(db, userId) {
  const token = randomBytes(32).toString('base64url')
  await db.query(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashToken(token), userId])
  return `${config.appUrl}/#/reset-password?token=${token}`
}

router.post('/login', limiter, async (req, res) => {
  const { email, password, remember } = parse(z.object({ email: z.email().trim(), password: z.string().min(1).max(200), remember: z.boolean().optional() }), req.body)
  const u = await one('SELECT id, password_hash, is_active FROM users WHERE lower(email) = lower($1)', [email])
  // Same message for unknown email and wrong password so accounts cannot be enumerated.
  const ok = u?.password_hash && (await bcrypt.compare(password, u.password_hash))
  if (!ok) throw unauthorized('Invalid email or password')
  if (!u.is_active) throw unauthorized('Your account is not active yet. Contact the Super Admin.')
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id])
  res.json({ token: signToken(u.id, remember), user: await profile(u.id) })
})

router.post('/register', limiter, async (req, res) => {
  const d = parse(z.object({ name: z.string().trim().min(1, 'Name is required').max(100), email: z.email().trim(), password: passwordSchema, department: optText(100) }), req.body)
  const exists = await one('SELECT 1 FROM users WHERE lower(email) = lower($1)', [d.email])
  if (exists) throw conflict('An account with this email already exists')
  await query(
    `INSERT INTO users (name, email, password_hash, role_id, department, is_active, self_registered)
     SELECT $1, $2, $3, id, $4, false, true FROM roles WHERE code = 'requester'`,
    [d.name, d.email, await bcrypt.hash(d.password, 10), d.department],
  )
  const admins = await query(`SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' AND u.is_active`)
  sendEmails(admins.rows.map((a) => ({ to: a.email, subject: 'GPMS: new registration awaiting activation', text: `${d.name} <${d.email}> registered and is waiting for activation.` })))
  res.status(201).json({ message: 'Registration submitted. A Super Admin will activate your account.' })
})

router.post('/forgot-password', limiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.email().trim() }), req.body)
  const u = await one('SELECT id, email FROM users WHERE lower(email) = lower($1) AND is_active', [email])
  if (u) {
    const link = await tx((db) => createResetLink(db, u.id))
    sendEmails([{ to: u.email, subject: 'GPMS password reset', text: `Reset your GPMS password (valid for 1 hour):\n${link}` }])
    if (config.env !== 'production') res.set('X-Dev-Reset-Link', link)
  }
  res.json({ message: 'If the email is registered, a reset link has been sent.' })
})

router.post('/reset-password', limiter, async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(20), password: passwordSchema }), req.body)
  await tx(async (db) => {
    const t = (await db.query('SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE', [hashToken(token)])).rows[0]
    if (!t) throw badRequest('This reset link is invalid or has expired')
    await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(password, 10), t.user_id])
    await db.query('UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1', [hashToken(token)])
  })
  res.json({ message: 'Password updated. You can sign in now.' })
})

router.get('/me', authenticate, async (req, res) => res.json(await profile(req.user.id)))

router.patch('/me', authenticate, async (req, res) => {
  const d = parse(z.object({ name: z.string().trim().min(1).max(100), phone: optText(30), department: optText(100) }), req.body)
  await query('UPDATE users SET name = $1, phone = $2, department = $3, updated_at = now() WHERE id = $4', [d.name, d.phone, d.department, req.user.id])
  res.json(await profile(req.user.id))
})

router.post('/change-password', authenticate, async (req, res) => {
  const d = parse(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }), req.body)
  const u = await one('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
  if (!u.password_hash || !(await bcrypt.compare(d.currentPassword, u.password_hash))) throw badRequest('Current password is incorrect')
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(d.newPassword, 10), req.user.id])
  res.json({ message: 'Password changed' })
})

export default router
