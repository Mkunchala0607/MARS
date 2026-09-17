import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { one, query } from '../db.js'
import { forbidden, unauthorized } from './http.js'

export const signToken = (userId, remember = false) =>
  jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn })

// Permissions change rarely; cache per role for a short time to avoid a query per request.
const permCache = new Map()
const PERM_TTL_MS = 30_000

export async function permissionsForRole(roleId) {
  const hit = permCache.get(roleId)
  if (hit && hit.at > Date.now() - PERM_TTL_MS) return hit.perms
  const { rows } = await query('SELECT screen_code FROM role_permissions WHERE role_id = $1', [roleId])
  const perms = new Set(rows.map((r) => r.screen_code))
  permCache.set(roleId, { perms, at: Date.now() })
  return perms
}

export const clearPermissionCache = () => permCache.clear()

/** Loads req.user from the Bearer token. Rejects inactive accounts even if the token is still valid. */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next(unauthorized())
  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    return next(unauthorized('Session expired, please sign in again'))
  }
  const user = await one(
    `SELECT u.id, u.name, u.email, u.department, u.phone, u.vendor_id, u.is_active, r.id AS role_id, r.code AS role, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [payload.sub],
  )
  if (!user || !user.is_active) return next(unauthorized('Account is inactive'))
  user.permissions = await permissionsForRole(user.role_id)
  req.user = user
  next()
}

/** Require at least one of the given screen permissions. */
export const requirePermission =
  (...screens) =>
  (req, _res, next) =>
    screens.some((s) => req.user.permissions.has(s)) ? next() : next(forbidden())

/** Roles that may see every gate pass plant-wide; everyone else only sees their own. */
export const PLANT_WIDE_ROLES = new Set(['approver', 'security', 'store', 'admin'])
export const seesAll = (user) => PLANT_WIDE_ROLES.has(user.role)
