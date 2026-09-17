import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { nextDocumentNo, one, query, tx } from '../db.js'
import { authenticate } from '../lib/auth.js'
import { addTimeline, approverIds, notify, sendEmails } from '../lib/events.js'
import { conflict, forbidden, notFound, parse } from '../lib/http.js'
import { idParam, optText, z } from '../lib/validators.js'

const SELECT = `
  SELECT v.*, h.skin_disease, h.eye_disease, h.respiratory_disease, h.allergies, h.typhoid_history, h.details AS health_details,
         h.gmp_acknowledged, h.signature_name, h.has_health_flag, d.name AS decided_by_name
    FROM visitor_gate_passes v
    JOIN visitor_health_declarations h ON h.visitor_gate_pass_id = v.id
    LEFT JOIN users d ON d.id = v.decided_by`

const toVisitor = (r) => ({
  id: r.id,
  passNo: r.pass_no,
  name: r.visitor_name,
  contactNo: r.contact_no,
  comingFrom: r.coming_from,
  hostName: r.host_name,
  purpose: r.purpose,
  laptopDetails: r.laptop_details,
  status: r.status,
  decidedBy: r.decided_by_name,
  decidedAt: r.decided_at,
  decisionRemarks: r.decision_remarks,
  inTime: r.in_time,
  outTime: r.out_time,
  createdAt: r.created_at,
  health: {
    skinDisease: r.skin_disease,
    eyeDisease: r.eye_disease,
    respiratoryDisease: r.respiratory_disease,
    allergies: r.allergies,
    typhoidHistory: r.typhoid_history,
    details: r.health_details,
    hasFlag: r.has_health_flag,
  },
})

// ───────── public (no login): visitor scans the QR at the gate ─────────
export const publicRouter = Router()
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: config.env === 'test' ? 1000 : 30, standardHeaders: 'draft-8', legacyHeaders: false })

const applySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    contactNo: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number'),
    comingFrom: z.string().trim().min(1, 'Company is required').max(150),
    hostName: z.string().trim().min(1, 'Whom to meet is required').max(100),
    purpose: optText(300),
    laptopDetails: optText(150),
    health: z.object({
      skinDisease: z.boolean(),
      eyeDisease: z.boolean(),
      respiratoryDisease: z.boolean(),
      allergies: z.boolean(),
      typhoidHistory: z.boolean(),
      details: optText(500),
    }),
    gmpAcknowledged: z.literal(true, { message: 'You must accept the GMP guidelines' }),
    signatureName: z.string().trim().min(1, 'Signature is required').max(100),
  })
  .refine((d) => !Object.entries(d.health).some(([k, v]) => k !== 'details' && v) || d.health.details, {
    path: ['health', 'details'],
    message: 'Please give brief details',
  })

publicRouter.post('/visitors', limiter, async (req, res) => {
  const d = parse(applySchema, req.body)
  const accessToken = randomBytes(24).toString('base64url')
  let mails = []
  const passNo = await tx(async (db) => {
    const no = await nextDocumentNo(db, 'VIS')
    const host = (await db.query('SELECT id FROM users WHERE lower(name) = lower($1) AND is_active LIMIT 1', [d.hostName])).rows[0]
    const { rows } = await db.query(
      `INSERT INTO visitor_gate_passes (pass_no, access_token, visitor_name, contact_no, coming_from, host_user_id, host_name, purpose, laptop_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [no, accessToken, d.name, d.contactNo, d.comingFrom, host?.id || null, d.hostName, d.purpose, d.laptopDetails],
    )
    const id = rows[0].id
    const h = d.health
    await db.query(
      `INSERT INTO visitor_health_declarations (visitor_gate_pass_id, skin_disease, eye_disease, respiratory_disease, allergies, typhoid_history, details, gmp_acknowledged, signature_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, h.skinDisease, h.eyeDisease, h.respiratoryDisease, h.allergies, h.typhoidHistory, h.details, true, d.signatureName],
    )
    await addTimeline(db, { entityType: 'visitor', entityId: id, event: 'Submitted', actor: { id: null, name: d.name } })
    const flagged = h.skinDisease || h.eyeDisease || h.respiratoryDisease || h.allergies || h.typhoidHistory
    mails = await notify(
      db,
      [host?.id, ...(await approverIds(db))],
      flagged ? `Visitor ${d.name} (${d.comingFrom}) declared a health condition - review needed` : `Visitor ${d.name} (${d.comingFrom}) requested entry to meet ${d.hostName}`,
      '/approvals',
    )
    return no
  })
  sendEmails(mails)
  res.status(201).json({ passNo, accessToken, status: 'Pending' })
})

publicRouter.get('/visitors/:token', async (req, res) => {
  const r = await one('SELECT pass_no, visitor_name, host_name, status, in_time, out_time FROM visitor_gate_passes WHERE access_token = $1', [req.params.token])
  if (!r) throw notFound('Visitor pass not found')
  res.json({ passNo: r.pass_no, name: r.visitor_name, hostName: r.host_name, status: r.status, inTime: r.in_time, outTime: r.out_time })
})

// ───────── staff ─────────
export const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const p = req.user.permissions
  if (!p.has('visitors') && !p.has('approvals') && !p.has('reports')) throw forbidden()
  const q = parse(
    z.object({ status: z.enum(['Pending', 'Approved', 'Rejected']).optional(), inside: z.enum(['true']).optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }),
    req.query,
  )
  const where = []
  const params = []
  const add = (sql, v) => (params.push(v), where.push(sql.replace('?', `$${params.length}`)))
  if (q.status) add('v.status = ?', q.status)
  if (q.inside) where.push('v.in_time IS NOT NULL AND v.out_time IS NULL')
  if (q.from) add('v.created_at >= ?::date', q.from)
  if (q.to) add(`v.created_at < (?::date + interval '1 day')`, q.to)
  const { rows } = await query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY v.created_at DESC LIMIT ${q.limit}`, params)
  res.json({ data: rows.map(toVisitor) })
})

router.post('/:id/decision', async (req, res) => {
  if (!req.user.permissions.has('approvals')) throw forbidden()
  const id = idParam(req.params.id)
  const { decision, remarks } = parse(
    z.object({ decision: z.enum(['Approved', 'Rejected']), remarks: optText(500) }).refine((d) => d.decision === 'Approved' || d.remarks, { path: ['remarks'], message: 'Remarks are required to reject' }),
    req.body,
  )
  await tx(async (db) => {
    const v = (await db.query('SELECT status FROM visitor_gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!v) throw notFound('Visitor pass not found')
    if (v.status !== 'Pending') throw conflict(`Visitor request is already ${v.status.toLowerCase()}`)
    await db.query('UPDATE visitor_gate_passes SET status = $1, decided_by = $2, decided_at = now(), decision_remarks = $3 WHERE id = $4', [decision, req.user.id, remarks, id])
    await addTimeline(db, { entityType: 'visitor', entityId: id, event: decision, actor: req.user, remarks })
  })
  res.json(toVisitor(await one(`${SELECT} WHERE v.id = $1`, [id])))
})

router.post('/:id/:move', async (req, res) => {
  if (!req.user.permissions.has('visitors')) throw forbidden()
  const id = idParam(req.params.id)
  const move = req.params.move
  if (!['check-in', 'check-out'].includes(move)) throw notFound()
  await tx(async (db) => {
    const v = (await db.query('SELECT status, in_time, out_time FROM visitor_gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!v) throw notFound('Visitor pass not found')
    if (v.status !== 'Approved') throw conflict('Visitor is not approved for entry')
    if (move === 'check-in') {
      if (v.in_time) throw conflict('Visitor is already checked in')
      await db.query('UPDATE visitor_gate_passes SET in_time = now(), checked_in_by = $1 WHERE id = $2', [req.user.id, id])
    } else {
      if (!v.in_time || v.out_time) throw conflict('Visitor is not inside the plant')
      await db.query('UPDATE visitor_gate_passes SET out_time = now() WHERE id = $1', [id])
    }
    await addTimeline(db, { entityType: 'visitor', entityId: id, event: move === 'check-in' ? 'CheckedIn' : 'CheckedOut', actor: req.user })
  })
  res.json(toVisitor(await one(`${SELECT} WHERE v.id = $1`, [id])))
})
