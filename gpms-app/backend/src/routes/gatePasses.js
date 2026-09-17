import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { config } from '../config.js'
import { nextDocumentNo, one, query, tx } from '../db.js'
import { seesAll } from '../lib/auth.js'
import { addTimeline, approverIds, audit, notify, sendEmails } from '../lib/events.js'
import { badRequest, conflict, forbidden, notFound, parse } from '../lib/http.js'
import { PASS_TYPES, decisionSchema, gatePassSchema, idParam, listQuerySchema, normaliseVehicle, reasonSchema, z } from '../lib/validators.js'

const router = Router()

const SELECT_PASS = `
  SELECT gp.*, u.name AS requester_name, v.name AS vendor_name, v.gstin AS vendor_gstin, v.code AS vendor_code,
         ab.name AS approved_by_name, rd.expected_return_date, rd.returned_at,
         sm.from_location, sm.to_location, sm.movement_type
    FROM gate_passes gp
    JOIN users u ON u.id = gp.requester_id
    LEFT JOIN vendors v ON v.id = gp.vendor_id
    LEFT JOIN users ab ON ab.id = gp.approved_by
    LEFT JOIN rgp_details rd ON rd.gate_pass_id = gp.id
    LEFT JOIN store_movement_details sm ON sm.gate_pass_id = gp.id`

/** Shape a DB row into the API representation. */
export function toPass(r) {
  return {
    id: r.id,
    passNo: r.pass_no,
    type: r.gate_pass_type,
    typeLabel: PASS_TYPES[r.gate_pass_type].label,
    direction: PASS_TYPES[r.gate_pass_type].direction,
    status: r.status,
    gateStatus: r.gate_status,
    isDirectEntry: r.is_direct_entry,
    requester: { id: r.requester_id, name: r.requester_name },
    department: r.department,
    vendor: r.vendor_id ? { id: r.vendor_id, name: r.vendor_name, code: r.vendor_code, gstin: r.vendor_gstin } : null,
    partyName: r.gate_pass_type === 'STORE' ? `Internal - ${r.from_location} -> ${r.to_location}` : r.vendor_name,
    purpose: r.purpose,
    despatchedThrough: r.despatched_through,
    lrRrNo: r.lr_rr_no,
    freightTerms: r.freight_terms,
    freightAmount: r.freight_amount,
    insurance: r.insurance,
    noOfPackages: r.no_of_packages,
    poNumber: r.po_number,
    inwardDate: r.inward_date,
    expectedReturnDate: r.expected_return_date ?? null,
    returnedAt: r.returned_at ?? null,
    fromLocation: r.from_location ?? null,
    toLocation: r.to_location ?? null,
    movementType: r.movement_type ?? null,
    vehicleNo: r.vehicle_no,
    driverName: r.driver_name,
    invoiceNo: r.invoice_no,
    sealNo: r.seal_no,
    totalValue: r.total_value,
    approvedBy: r.approved_by_name || null,
    decidedAt: r.decided_at,
    decisionRemarks: r.decision_remarks,
    deletedAt: r.deleted_at,
    deleteReason: r.delete_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const canViewPass = (user, row) => seesAll(user) || row.requester_id === user.id

async function loadFullPass(id, user) {
  const row = await one(`${SELECT_PASS} WHERE gp.id = $1`, [id])
  if (!row || !canViewPass(user, row)) throw notFound('Gate pass not found')
  const [items, attachments, timeline, weighments] = await Promise.all([
    query(`SELECT id, line_no, material_id, description, uom_code, quantity, approx_value, remarks FROM gate_pass_items WHERE gate_pass_id = $1 ORDER BY line_no`, [id]),
    query(`SELECT id, original_name, mime_type, size_bytes, uploaded_at FROM attachments WHERE gate_pass_id = $1 ORDER BY id`, [id]),
    query(`SELECT event, actor_name, remarks, created_at FROM approval_timeline WHERE entity_type = 'gate_pass' AND entity_id = $1 ORDER BY created_at, id`, [id]),
    query(`SELECT slip_no, net_weight, gross_weight, tare_weight, status FROM weighbridge_entries WHERE gate_pass_id = $1 ORDER BY id DESC`, [id]),
  ])
  return {
    ...toPass(row),
    items: items.rows.map((i) => ({ id: i.id, lineNo: i.line_no, materialId: i.material_id, description: i.description, uom: i.uom_code, quantity: i.quantity, approxValue: i.approx_value, remarks: i.remarks })),
    attachments: attachments.rows.map((a) => ({ id: a.id, name: a.original_name, mimeType: a.mime_type, size: a.size_bytes, uploadedAt: a.uploaded_at })),
    timeline: timeline.rows.map((t) => ({ event: t.event, actor: t.actor_name, remarks: t.remarks, at: t.created_at })),
    weighments: weighments.rows.map((w) => ({ slipNo: w.slip_no, gross: w.gross_weight, tare: w.tare_weight, net: w.net_weight, status: w.status })),
  }
}

// ───────── list / search ─────────
router.get('/', async (req, res) => {
  const q = parse(listQuerySchema, req.query)
  // Build the WHERE clause twice: the list uses every filter, the status counters ignore the status filter.
  const build = (withStatus) => {
    const where = []
    const params = []
    const p = (v) => (params.push(v), `$${params.length}`)
    if (!seesAll(req.user)) where.push(`gp.requester_id = ${p(req.user.id)}`)
    if (q.type) where.push(`gp.gate_pass_type = ${p(q.type)}`)
    if (withStatus && q.status) where.push(`gp.status = ${p(q.status)}`)
    if (q.from) where.push(`gp.created_at >= ${p(q.from)}::date`)
    if (q.to) where.push(`gp.created_at < (${p(q.to)}::date + interval '1 day')`)
    if (q.direct === 'true') where.push('gp.is_direct_entry')
    if (q.gateStatus) where.push(`gp.gate_status = ANY(${p(q.gateStatus.split(','))}::text[])`)
    if (q.onlyDeleted === 'true') where.push('gp.deleted_at IS NOT NULL')
    else if (q.includeDeleted !== 'true') where.push('gp.deleted_at IS NULL')
    if (q.q) {
      const t = p(`%${q.q}%`)
      where.push(`(gp.pass_no ILIKE ${t} OR v.name ILIKE ${t} OR gp.vehicle_no ILIKE ${t} OR u.name ILIKE ${t})`)
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
  }
  const list = build(true)
  const all = build(false)

  const [rows, counts] = await Promise.all([
    query(`${SELECT_PASS} ${list.sql} ORDER BY gp.created_at DESC, gp.id DESC LIMIT ${Number(q.limit)} OFFSET ${Number(q.offset)}`, list.params),
    query(
      `SELECT gp.status, count(*)::int AS n FROM gate_passes gp JOIN users u ON u.id = gp.requester_id LEFT JOIN vendors v ON v.id = gp.vendor_id ${all.sql} GROUP BY gp.status`,
      all.params,
    ),
  ])
  // First-line material per row for list display.
  const ids = rows.rows.map((r) => r.id)
  const firstItems = ids.length
    ? (
        await query(
          `SELECT DISTINCT ON (gate_pass_id) gate_pass_id, description, count(*) OVER (PARTITION BY gate_pass_id) AS n
             FROM gate_pass_items WHERE gate_pass_id = ANY($1::bigint[]) ORDER BY gate_pass_id, line_no`,
          [ids],
        )
      ).rows
    : []
  const firstById = Object.fromEntries(firstItems.map((i) => [i.gate_pass_id, i]))
  const c = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]))
  res.json({
    data: rows.rows.map((r) => ({ ...toPass(r), firstItem: firstById[r.id]?.description || null, itemCount: firstById[r.id]?.n || 0 })),
    counts: { Pending: c.Pending || 0, Approved: c.Approved || 0, Rejected: c.Rejected || 0, total: (c.Pending || 0) + (c.Approved || 0) + (c.Rejected || 0) },
  })
})

// Gate lookup by pass number (or QR payload) or vehicle number.
router.get('/lookup', async (req, res) => {
  if (!req.user.permissions.has('gate')) throw forbidden()
  const term = String(req.query.q || '').trim().toUpperCase().replace(/^GPMS:/, '')
  if (!term) throw badRequest('Enter a gate pass or vehicle number')
  const row = await one(
    `${SELECT_PASS} WHERE upper(gp.pass_no) = $1 OR upper(replace(gp.vehicle_no, '-', '')) = replace($1, '-', '')
     ORDER BY (upper(gp.pass_no) = $1) DESC, (gp.status = 'Approved' AND gp.deleted_at IS NULL) DESC, gp.created_at DESC LIMIT 1`,
    [term],
  )
  if (!row) throw notFound('No gate pass found for that number')
  res.json(await loadFullPass(row.id, req.user))
})

router.get('/:id', async (req, res) => {
  res.json(await loadFullPass(idParam(req.params.id), req.user))
})

// ───────── create / amend ─────────
async function writeTypeDetails(db, id, d) {
  await db.query('DELETE FROM gate_pass_items WHERE gate_pass_id = $1', [id])
  for (const [i, it] of d.items.entries())
    await db.query(
      `INSERT INTO gate_pass_items (gate_pass_id, line_no, material_id, description, uom_code, quantity, approx_value, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, i + 1, it.materialId || null, it.description, it.uom, it.quantity, it.approxValue, it.remarks],
    )
  if (d.type === 'RGP')
    await db.query(
      `INSERT INTO rgp_details (gate_pass_id, expected_return_date) VALUES ($1, $2) ON CONFLICT (gate_pass_id) DO UPDATE SET expected_return_date = $2`,
      [id, d.expectedReturnDate],
    )
  if (d.type === 'STORE')
    await db.query(
      `INSERT INTO store_movement_details (gate_pass_id, from_location, to_location, movement_type) VALUES ($1,$2,$3,$4)
       ON CONFLICT (gate_pass_id) DO UPDATE SET from_location = $2, to_location = $3, movement_type = $4`,
      [id, d.fromLocation, d.toLocation, d.movementType],
    )
}

const passColumns = (d) => [
  d.vendorId || null, d.purpose, d.despatchedThrough, d.lrRrNo, d.freightTerms || null, d.freightAmount ?? null, d.insurance || null, d.noOfPackages ?? null,
  d.poNumber, d.inwardDate || null, d.vehicleNo ? normaliseVehicle(d.vehicleNo) : null, d.driverName, d.invoiceNo, d.sealNo,
  d.items.reduce((s, i) => s + i.approxValue, 0),
]

async function assertActiveVendor(db, vendorId) {
  if (!vendorId) return
  const v = (await db.query('SELECT is_active FROM vendors WHERE id = $1', [vendorId])).rows[0]
  if (!v) throw badRequest('Selected party does not exist')
  if (!v.is_active) throw badRequest('Selected party is inactive')
}

router.post('/', async (req, res) => {
  const d = parse(gatePassSchema, req.body)
  const user = req.user
  const direct = !!d.directReason
  if (direct ? !user.permissions.has('direct') : !user.permissions.has(d.type)) throw forbidden()
  if (user.role === 'vendor') {
    if (d.type !== 'INWARD') throw forbidden('Registered persons can only raise Inward requests')
    d.vendorId = user.vendor_id
  }

  let mails = []
  const id = await tx(async (db) => {
    await assertActiveVendor(db, d.vendorId)
    const passNo = await nextDocumentNo(db, PASS_TYPES[d.type].prefix)
    const { rows } = await db.query(
      `INSERT INTO gate_passes (pass_no, gate_pass_type, status, gate_status, is_direct_entry, requester_id, department,
          vendor_id, purpose, despatched_through, lr_rr_no, freight_terms, freight_amount, insurance, no_of_packages,
          po_number, inward_date, vehicle_no, driver_name, invoice_no, seal_no, total_value, approved_by, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
      [
        passNo, d.type, direct ? 'Approved' : 'Pending', direct && d.type !== 'STORE' ? 'AwaitingGate' : 'NotReady', direct, user.id, user.department,
        ...passColumns(d), direct ? user.id : null, direct ? new Date() : null,
      ],
    )
    const newId = rows[0].id
    await writeTypeDetails(db, newId, d)
    if (direct) {
      await addTimeline(db, { entityType: 'gate_pass', entityId: newId, event: 'DirectEntry', actor: user, remarks: d.directReason })
      await audit(db, { actor: user, action: 'DIRECT_CREATE', entityType: 'gate_pass', entityRef: passNo, reason: d.directReason, ip: req.ip })
    } else {
      await addTimeline(db, { entityType: 'gate_pass', entityId: newId, event: 'Submitted', actor: user })
      mails = await notify(db, await approverIds(db), `${passNo} from ${user.name} is awaiting your approval`, `/pass/${newId}`)
    }
    return newId
  })
  sendEmails(mails)
  res.status(201).json(await loadFullPass(id, user))
})

// Amend & resubmit a rejected request (owner only).
router.put('/:id', async (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(gatePassSchema, req.body)
  const user = req.user
  let mails = []
  await tx(async (db) => {
    const cur = (await db.query('SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!cur || cur.requester_id !== user.id) throw notFound('Gate pass not found')
    if (cur.deleted_at) throw conflict('This gate pass has been deleted')
    if (cur.status !== 'Rejected') throw conflict('Only rejected requests can be amended')
    if (d.type !== cur.gate_pass_type) throw badRequest('Gate pass type cannot be changed')
    if (user.role === 'vendor') d.vendorId = user.vendor_id
    await assertActiveVendor(db, d.vendorId)
    await db.query(
      `UPDATE gate_passes SET vendor_id=$1, purpose=$2, despatched_through=$3, lr_rr_no=$4, freight_terms=$5, freight_amount=$6, insurance=$7,
          no_of_packages=$8, po_number=$9, inward_date=$10, vehicle_no=$11, driver_name=$12, invoice_no=$13, seal_no=$14, total_value=$15,
          status='Pending', approved_by=NULL, decided_at=NULL, decision_remarks=NULL, updated_at=now()
        WHERE id=$16`,
      [...passColumns(d), id],
    )
    await writeTypeDetails(db, id, d)
    await addTimeline(db, { entityType: 'gate_pass', entityId: id, event: 'Resubmitted', actor: user })
    mails = await notify(db, await approverIds(db), `${cur.pass_no} was amended and resubmitted by ${user.name}`, `/pass/${id}`)
  })
  sendEmails(mails)
  res.json(await loadFullPass(id, user))
})

// ───────── approvals ─────────
async function decideOne(db, id, { decision, remarks }, user) {
  const cur = (await db.query('SELECT id, pass_no, status, requester_id, deleted_at, gate_pass_type FROM gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
  if (!cur || cur.deleted_at) throw notFound(`Gate pass ${id} not found`)
  if (cur.status !== 'Pending') throw conflict(`${cur.pass_no} is already ${cur.status.toLowerCase()}`)
  if (cur.requester_id === user.id) throw forbidden(`You cannot approve your own request (${cur.pass_no})`)
  const gate = decision === 'Approved' && cur.gate_pass_type !== 'STORE' ? 'AwaitingGate' : 'NotReady'
  await db.query(
    `UPDATE gate_passes SET status=$1, gate_status=$2, approved_by=$3, decided_at=now(), decision_remarks=$4, updated_at=now() WHERE id=$5`,
    [decision, gate, user.id, remarks, id],
  )
  await addTimeline(db, { entityType: 'gate_pass', entityId: id, event: decision, actor: user, remarks })
  return notify(db, [cur.requester_id], `${cur.pass_no} was ${decision.toLowerCase()} by ${user.name}${remarks ? `: ${remarks}` : ''}`, `/pass/${id}`)
}

router.post('/:id/decision', async (req, res) => {
  if (!req.user.permissions.has('approvals')) throw forbidden()
  const id = idParam(req.params.id)
  const body = parse(decisionSchema, req.body)
  const mails = await tx((db) => decideOne(db, id, body, req.user))
  sendEmails(mails)
  res.json(await loadFullPass(id, req.user))
})

router.post('/decisions/bulk', async (req, res) => {
  if (!req.user.permissions.has('approvals')) throw forbidden()
  const { ids, remarks } = parse(z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(100), remarks: z.string().trim().max(500).optional() }), req.body)
  // All-or-nothing: if any request cannot be approved, none are.
  const mails = await tx(async (db) => {
    const out = []
    for (const id of [...new Set(ids)]) out.push(await decideOne(db, id, { decision: 'Approved', remarks: remarks || 'Bulk approved' }, req.user))
    return out
  })
  sendEmails(mails)
  res.json({ approved: ids.length })
})

// ───────── elevated delete ─────────
router.delete('/:id', async (req, res) => {
  if (!req.user.permissions.has('direct')) throw forbidden()
  const id = idParam(req.params.id)
  const { reason } = parse(reasonSchema, req.body || {})
  await tx(async (db) => {
    const cur = (await db.query('SELECT pass_no, deleted_at FROM gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!cur) throw notFound('Gate pass not found')
    if (cur.deleted_at) throw conflict('Gate pass is already deleted')
    await db.query('UPDATE gate_passes SET deleted_at = now(), deleted_by = $1, delete_reason = $2, updated_at = now() WHERE id = $3', [req.user.id, reason, id])
    await addTimeline(db, { entityType: 'gate_pass', entityId: id, event: 'Deleted', actor: req.user, remarks: reason })
    await audit(db, { actor: req.user, action: 'DELETE', entityType: 'gate_pass', entityRef: cur.pass_no, reason, ip: req.ip })
  })
  res.json({ ok: true })
})

// ───────── gate movement ─────────
const gateSchema = z.object({ action: z.enum(['exit', 'enter', 'return']), sealNo: z.string().trim().max(50).optional(), remarks: z.string().trim().max(500).optional() })

class SealMismatch extends Error {}

router.post('/:id/gate', async (req, res) => {
  if (!req.user.permissions.has('gate')) throw forbidden()
  const id = idParam(req.params.id)
  const { action, sealNo, remarks } = parse(gateSchema, req.body)
  try {
    await tx(async (db) => {
      const p = (await db.query('SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE', [id])).rows[0]
      if (!p) throw notFound('Gate pass not found')
      if (p.deleted_at) throw conflict('Gate pass has been deleted - do not allow movement')
      if (p.status !== 'Approved') throw conflict(`Gate pass is ${p.status} - movement not allowed`)
      const dir = PASS_TYPES[p.gate_pass_type].direction
      let next
      if (action === 'exit') {
        if (dir !== 'Outward' || p.gate_status !== 'AwaitingGate') throw conflict('Exit is not valid for this pass in its current state')
        if (p.seal_no) {
          if (!sealNo) throw badRequest('Seal number must be verified before exit')
          if (sealNo.toUpperCase() !== p.seal_no.toUpperCase()) throw new SealMismatch()
        }
        next = 'Exited'
      } else if (action === 'enter') {
        if (dir !== 'Inward' || p.gate_status !== 'AwaitingGate') throw conflict('Entry is not valid for this pass in its current state')
        next = 'Entered'
      } else {
        if (p.gate_pass_type !== 'RGP' || p.gate_status !== 'Exited') throw conflict('Only RGP items that have exited can be marked returned')
        next = 'Returned'
        await db.query('UPDATE rgp_details SET returned_at = now(), returned_remarks = $1 WHERE gate_pass_id = $2', [remarks || null, id])
      }
      await db.query('UPDATE gate_passes SET gate_status = $1, updated_at = now() WHERE id = $2', [next, id])
      await addTimeline(db, { entityType: 'gate_pass', entityId: id, event: `Gate${next}`, actor: req.user, remarks })
    })
  } catch (err) {
    if (!(err instanceof SealMismatch)) throw err
    // Record the mismatch and alert approvers, then refuse the movement.
    const mails = await tx(async (db) => {
      const p = (await db.query('SELECT pass_no, approved_by FROM gate_passes WHERE id = $1', [id])).rows[0]
      await addTimeline(db, { entityType: 'gate_pass', entityId: id, event: 'SealMismatch', actor: req.user, remarks: `Seal presented: ${sealNo}` })
      return notify(db, [p.approved_by, ...(await approverIds(db))], `Seal mismatch at gate for ${p.pass_no} - vehicle held`, `/pass/${id}`)
    })
    sendEmails(mails)
    throw conflict('Seal number does not match - hold the vehicle; approval is required before movement')
  }
  res.json(await loadFullPass(id, req.user))
})

// ───────── attachments ─────────
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await mkdir(config.uploadDir, { recursive: true })
      cb(null, config.uploadDir)
    },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
})

router.post('/:id/attachments', upload.array('files', 10), async (req, res) => {
  const id = idParam(req.params.id)
  const p = await one('SELECT requester_id FROM gate_passes WHERE id = $1', [id])
  if (!p || (p.requester_id !== req.user.id && !req.user.permissions.has('direct'))) throw notFound('Gate pass not found')
  if (!req.files?.length) throw badRequest('Only PDF, JPG or PNG files are accepted')
  for (const f of req.files)
    await query(`INSERT INTO attachments (gate_pass_id, original_name, stored_name, mime_type, size_bytes, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)`, [
      id, f.originalname, f.filename, f.mimetype, f.size, req.user.id,
    ])
  res.status(201).json(await loadFullPass(id, req.user))
})

router.get('/:id/attachments/:attId', async (req, res) => {
  const id = idParam(req.params.id)
  await loadFullPass(id, req.user) // enforces visibility
  const a = await one('SELECT * FROM attachments WHERE id = $1 AND gate_pass_id = $2', [idParam(req.params.attId), id])
  if (!a) throw notFound()
  res.download(path.resolve(config.uploadDir, a.stored_name), a.original_name)
})

export default router
