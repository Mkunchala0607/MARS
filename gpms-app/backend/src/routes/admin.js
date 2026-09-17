import { Router } from 'express'
import { config } from '../config.js'
import { one, query, tx } from '../db.js'
import { clearPermissionCache, requirePermission } from '../lib/auth.js'
import { audit, sendEmails } from '../lib/events.js'
import { badRequest, conflict, forbidden, notFound, parse } from '../lib/http.js'
import { idParam, optText, z } from '../lib/validators.js'
import { createResetLink } from './auth.js'

export const usersRouter = Router()
export const rolesRouter = Router()
export const auditRouter = Router()

// ───────── users ─────────
const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.department, u.phone, u.vendor_id, u.is_active, u.self_registered, u.last_login_at, u.created_at,
         r.code AS role, r.name AS role_name, v.name AS vendor_name
    FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN vendors v ON v.id = u.vendor_id`

const toUser = (r) => ({
  id: r.id, name: r.name, email: r.email, department: r.department, phone: r.phone, role: r.role, roleName: r.role_name,
  vendorId: r.vendor_id, vendorName: r.vendor_name, isActive: r.is_active, selfRegistered: r.self_registered, lastLoginAt: r.last_login_at, createdAt: r.created_at,
})

const userSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: z.email().trim(),
    role: z.enum(['requester', 'vendor', 'approver', 'security', 'store', 'admin']),
    department: optText(100),
    phone: optText(30),
    vendorId: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((d) => d.role !== 'vendor' || d.vendorId, { path: ['vendorId'], message: 'Registered persons must be linked to a vendor' })

usersRouter.use(requirePermission('users'))

usersRouter.get('/', async (_req, res) => {
  res.json({ data: (await query(`${USER_SELECT} ORDER BY u.is_active, u.name`)).rows.map(toUser) })
})

usersRouter.post('/', async (req, res) => {
  const d = parse(userSchema, req.body)
  const result = await tx(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, role_id, department, phone, vendor_id) SELECT $1, $2, id, $3, $4, $5 FROM roles WHERE code = $6 RETURNING id`,
      [d.name, d.email, d.department, d.phone, d.role === 'vendor' ? d.vendorId : null, d.role],
    )
    // New users set their own password through an emailed invite link.
    const link = await createResetLink(db, rows[0].id)
    await audit(db, { actor: req.user, action: 'USER_CREATE', entityType: 'user', entityRef: d.email, details: { role: d.role }, ip: req.ip })
    return { id: rows[0].id, link }
  })
  sendEmails([{ to: d.email, subject: 'Your GPMS account', text: `An account has been created for you. Set your password here (valid 1 hour):\n${result.link}` }])
  res.status(201).json({ ...toUser(await one(`${USER_SELECT} WHERE u.id = $1`, [result.id])), ...(config.isProd ? {} : { devInviteLink: result.link }) })
})

usersRouter.put('/:id', async (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(userSchema, req.body)
  if (id === req.user.id && d.role !== req.user.role) throw badRequest('You cannot change your own role')
  await tx(async (db) => {
    const before = (await db.query(`SELECT r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id])).rows[0]
    if (!before) throw notFound('User not found')
    await db.query(
      `UPDATE users SET name = $1, email = $2, role_id = (SELECT id FROM roles WHERE code = $3), department = $4, phone = $5, vendor_id = $6, updated_at = now() WHERE id = $7`,
      [d.name, d.email, d.role, d.department, d.phone, d.role === 'vendor' ? d.vendorId : null, id],
    )
    if (before.role !== d.role) await audit(db, { actor: req.user, action: 'USER_ROLE_CHANGE', entityType: 'user', entityRef: d.email, details: { from: before.role, to: d.role }, ip: req.ip })
  })
  res.json(toUser(await one(`${USER_SELECT} WHERE u.id = $1`, [id])))
})

usersRouter.patch('/:id/active', async (req, res) => {
  const id = idParam(req.params.id)
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body)
  if (id === req.user.id) throw badRequest('You cannot deactivate your own account')
  await tx(async (db) => {
    const u = (await db.query('UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING email', [isActive, id])).rows[0]
    if (!u) throw notFound('User not found')
    await audit(db, { actor: req.user, action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', entityType: 'user', entityRef: u.email, ip: req.ip })
  })
  res.json({ id, isActive })
})

// ───────── roles & permissions ─────────
rolesRouter.get('/', async (req, res) => {
  if (!req.user.permissions.has('roles')) throw forbidden()
  const [roles, screens, perms] = await Promise.all([
    query(`SELECT r.id, r.code, r.name, r.description, (SELECT count(*)::int FROM users u WHERE u.role_id = r.id) AS user_count FROM roles r ORDER BY r.id`),
    query('SELECT code, name, group_name FROM screens ORDER BY sort_order'),
    query('SELECT r.code AS role, p.screen_code FROM role_permissions p JOIN roles r ON r.id = p.role_id'),
  ])
  const matrix = {}
  for (const p of perms.rows) (matrix[p.role] ||= []).push(p.screen_code)
  res.json({
    roles: roles.rows.map((r) => ({ code: r.code, name: r.name, description: r.description, userCount: r.user_count })),
    screens: screens.rows.map((s) => ({ code: s.code, name: s.name, group: s.group_name })),
    permissions: matrix,
  })
})

rolesRouter.put('/:code/permissions', async (req, res) => {
  if (!req.user.permissions.has('roles')) throw forbidden()
  const { screens } = parse(z.object({ screens: z.array(z.string()).max(100) }), req.body)
  const code = req.params.code
  // Guard against locking everyone out of administration.
  if (code === 'admin' && !(screens.includes('users') && screens.includes('roles'))) throw badRequest('Super Admin must keep User and Role management')
  await tx(async (db) => {
    const role = (await db.query('SELECT id FROM roles WHERE code = $1', [code])).rows[0]
    if (!role) throw notFound('Role not found')
    const before = (await db.query('SELECT screen_code FROM role_permissions WHERE role_id = $1 ORDER BY 1', [role.id])).rows.map((r) => r.screen_code)
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id])
    const inserted = await db.query(`INSERT INTO role_permissions (role_id, screen_code) SELECT $1, code FROM screens WHERE code = ANY($2::text[]) RETURNING screen_code`, [role.id, screens])
    if (inserted.rowCount !== new Set(screens).size) throw conflict('One or more screens are unknown')
    await audit(db, { actor: req.user, action: 'PERMISSIONS_CHANGE', entityType: 'role', entityRef: code, details: { before, after: [...screens].sort() }, ip: req.ip })
  })
  clearPermissionCache()
  res.json({ role: code, screens })
})

// ───────── audit log ─────────
auditRouter.get('/', requirePermission('audit'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000)
  const { rows } = await query('SELECT id, actor_name, action, entity_type, entity_ref, reason, details, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT $1', [limit])
  res.json({ data: rows.map((r) => ({ id: r.id, actor: r.actor_name, action: r.action, entityType: r.entity_type, entityRef: r.entity_ref, reason: r.reason, details: r.details, at: r.created_at })) })
})
