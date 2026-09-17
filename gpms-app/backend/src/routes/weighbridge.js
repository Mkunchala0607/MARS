import { Router } from 'express'
import { one, query, tx } from '../db.js'
import { addTimeline, approverIds, notify, sendEmails } from '../lib/events.js'
import { badRequest, conflict, forbidden, notFound, parse } from '../lib/http.js'
import { idParam, optText, z } from '../lib/validators.js'

const router = Router()

const SELECT = `
  SELECT w.*, gp.pass_no, v.name AS party_name, wb.name AS weighbridge_name, u.name AS recorded_by_name,
         (SELECT string_agg(description, ', ' ORDER BY line_no) FROM gate_pass_items WHERE gate_pass_id = gp.id) AS material
    FROM weighbridge_entries w
    JOIN weighbridges wb ON wb.id = w.weighbridge_id
    JOIN users u ON u.id = w.recorded_by
    LEFT JOIN gate_passes gp ON gp.id = w.gate_pass_id
    LEFT JOIN vendors v ON v.id = gp.vendor_id`

const toEntry = (r) => ({
  id: r.id,
  slipNo: r.slip_no,
  weighbridge: r.weighbridge_name,
  gatePassId: r.gate_pass_id,
  gatePassNo: r.pass_no,
  partyName: r.party_name,
  material: r.material,
  vehicleNo: r.vehicle_no,
  invoiceNo: r.invoice_no,
  inTime: r.in_time,
  outTime: r.out_time,
  gross: r.gross_weight,
  tare: r.tare_weight,
  net: r.net_weight,
  status: r.status,
  recordedBy: r.recorded_by_name,
  createdAt: r.created_at,
})

router.get('/', async (req, res) => {
  const p = req.user.permissions
  if (!p.has('weighbridge') && !p.has('approvals') && !p.has('reports')) throw forbidden()
  const q = parse(z.object({ status: z.enum(['Pending', 'Approved', 'Rejected']).optional(), from: z.iso.date().optional(), to: z.iso.date().optional() }), req.query)
  const where = []
  const params = []
  const add = (sql, v) => (params.push(v), where.push(sql.replace('?', `$${params.length}`)))
  if (q.status) add('w.status = ?', q.status)
  if (q.from) add('w.in_time >= ?::date', q.from)
  if (q.to) add(`w.in_time < (?::date + interval '1 day')`, q.to)
  const { rows } = await query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY w.in_time DESC LIMIT 500`, params)
  res.json({ data: rows.map(toEntry) })
})

router.get('/weighbridges', async (_req, res) => {
  res.json({ data: (await query('SELECT id, name, location FROM weighbridges WHERE is_active ORDER BY id')).rows })
})

const entrySchema = z
  .object({
    gatePassId: z.coerce.number().int().positive({ message: 'Link a gate pass' }),
    weighbridgeId: z.coerce.number().int().positive().optional(),
    slipNo: z.string().trim().min(1, 'Slip number is required').max(50),
    invoiceNo: optText(100),
    inTime: z.iso.datetime({ offset: true, local: true }),
    outTime: z.iso.datetime({ offset: true, local: true }).optional().nullable(),
    grossWeight: z.coerce.number().positive('Gross weight is required'),
    tareWeight: z.coerce.number().positive('Tare weight is required'),
  })
  .refine((d) => d.grossWeight > d.tareWeight, { path: ['tareWeight'], message: 'Tare must be less than gross' })
  .refine((d) => !d.outTime || new Date(d.outTime) >= new Date(d.inTime), { path: ['outTime'], message: 'Out time must be after in time' })

router.post('/', async (req, res) => {
  if (!req.user.permissions.has('weighbridge')) throw forbidden()
  const d = parse(entrySchema, req.body)
  let mails = []
  const id = await tx(async (db) => {
    const gp = (await db.query('SELECT id, pass_no, status, deleted_at, vehicle_no, gate_pass_type FROM gate_passes WHERE id = $1', [d.gatePassId])).rows[0]
    if (!gp || gp.deleted_at) throw badRequest('Linked gate pass not found')
    if (gp.status !== 'Approved') throw badRequest('Weighment can only be linked to an approved gate pass')
    if (gp.gate_pass_type === 'STORE') throw badRequest('Store movements are not weighed')
    const wbId = d.weighbridgeId || (await db.query('SELECT id FROM weighbridges WHERE is_active ORDER BY id LIMIT 1')).rows[0]?.id
    if (!wbId) throw badRequest('No active weighbridge configured')
    const { rows } = await db.query(
      `INSERT INTO weighbridge_entries (slip_no, weighbridge_id, gate_pass_id, vehicle_no, invoice_no, in_time, out_time, gross_weight, tare_weight, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [d.slipNo, wbId, gp.id, gp.vehicle_no, d.invoiceNo, d.inTime, d.outTime || null, d.grossWeight, d.tareWeight, req.user.id],
    )
    await addTimeline(db, { entityType: 'weighment', entityId: rows[0].id, event: 'Submitted', actor: req.user })
    await addTimeline(db, { entityType: 'gate_pass', entityId: gp.id, event: 'Weighed', actor: req.user, remarks: `Slip ${d.slipNo}: net ${d.grossWeight - d.tareWeight} kg` })
    mails = await notify(db, await approverIds(db), `Weighment ${d.slipNo} for ${gp.pass_no} is awaiting approval`, '/approvals')
    return rows[0].id
  })
  sendEmails(mails)
  res.status(201).json(toEntry(await one(`${SELECT} WHERE w.id = $1`, [id])))
})

router.post('/:id/decision', async (req, res) => {
  if (!req.user.permissions.has('approvals')) throw forbidden()
  const id = idParam(req.params.id)
  const { decision, remarks } = parse(
    z.object({ decision: z.enum(['Approved', 'Rejected']), remarks: optText(500) }).refine((d) => d.decision === 'Approved' || d.remarks, { path: ['remarks'], message: 'Remarks are required to reject' }),
    req.body,
  )
  await tx(async (db) => {
    const w = (await db.query('SELECT status, recorded_by FROM weighbridge_entries WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!w) throw notFound('Weighment not found')
    if (w.status !== 'Pending') throw conflict(`Weighment is already ${w.status.toLowerCase()}`)
    if (w.recorded_by === req.user.id) throw forbidden('You cannot approve a weighment you recorded')
    await db.query('UPDATE weighbridge_entries SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3', [decision, req.user.id, id])
    await addTimeline(db, { entityType: 'weighment', entityId: id, event: decision, actor: req.user, remarks })
  })
  res.json(toEntry(await one(`${SELECT} WHERE w.id = $1`, [id])))
})

export default router
