import { Router } from 'express'
import { one, query } from '../db.js'
import { forbidden, notFound, parse } from '../lib/http.js'
import { GSTIN_RE, idParam, optText, z } from '../lib/validators.js'

const router = Router()

const code = z.string().trim().min(1, 'Code is required').max(30)
const name = z.string().trim().min(1, 'Name is required').max(150)
const date = z.iso.date().optional().nullable()

/**
 * Each master maps API field names ↔ table columns. `select` may join for display fields.
 * Field lists follow "Master Data and Tech Stack for MARS.docx".
 */
const MASTERS = {
  materials: {
    table: 'materials',
    schema: z.object({ code, description: name, hsnCode: optText(20), uom: z.enum(['Nos', 'Kg', 'Ltr', 'Mtr', 'Set']), category: z.enum(['Raw Material', 'Packaging', 'Finished Goods', 'Scrap', 'Spares']), defaultRate: z.coerce.number().min(0).optional().nullable() }),
    columns: { code: 'code', description: 'description', hsnCode: 'hsn_code', uom: 'uom_code', category: 'category', defaultRate: 'default_rate' },
    order: 'code',
  },
  vendors: {
    table: 'vendors',
    schema: z.object({
      code,
      name,
      gstin: z.string().trim().toUpperCase().regex(GSTIN_RE, 'Invalid GSTIN format').optional().nullable().or(z.literal('').transform(() => null)),
      address: optText(300),
      contactPerson: optText(100),
      phone: optText(30),
      email: z.email().optional().nullable().or(z.literal('').transform(() => null)),
      vendorType: z.enum(['Supplier', 'Transporter', 'Logistics']),
    }),
    columns: { code: 'code', name: 'name', gstin: 'gstin', address: 'address', contactPerson: 'contact_person', phone: 'phone', email: 'email', vendorType: 'vendor_type' },
    order: 'name',
  },
  contractors: {
    table: 'contractors',
    schema: z.object({ code, name, firmName: optText(150), contactPerson: optText(100), phone: optText(30), idProof: optText(100), validFrom: date, validTo: z.iso.date({ message: 'Valid till date is required' }) }),
    columns: { code: 'code', name: 'name', firmName: 'firm_name', contactPerson: 'contact_person', phone: 'phone', idProof: 'id_proof', validFrom: 'valid_from', validTo: 'valid_to' },
    order: 'name',
  },
  'sub-contractors': {
    table: 'sub_contractors',
    schema: z.object({ code, name, parentContractorId: z.coerce.number().int().positive({ message: 'Parent contractor is required' }), phone: optText(30), validFrom: date, validTo: z.iso.date({ message: 'Valid till date is required' }) }),
    columns: { code: 'code', name: 'name', parentContractorId: 'parent_contractor_id', phone: 'phone', validFrom: 'valid_from', validTo: 'valid_to' },
    extraSelect: ', (SELECT name FROM contractors c WHERE c.id = t.parent_contractor_id) AS parent_contractor_name',
    order: 'name',
  },
  'service-vendors': {
    table: 'service_vendors',
    schema: z.object({ code, name, serviceType: optText(50), phone: optText(30), validFrom: date, validTo: z.iso.date({ message: 'Contract valid till date is required' }) }),
    columns: { code: 'code', name: 'name', serviceType: 'service_type', phone: 'phone', validFrom: 'valid_from', validTo: 'valid_to' },
    order: 'name',
  },
}

const cfgFor = (kind) => {
  const cfg = MASTERS[kind]
  if (!cfg) throw notFound('Unknown master')
  return cfg
}

const toApi = (cfg, row) => {
  const out = { id: row.id, isActive: row.is_active }
  for (const [k, col] of Object.entries(cfg.columns)) out[k] = row[col]
  if (row.parent_contractor_name !== undefined) out.parentContractorName = row.parent_contractor_name
  return out
}

const requireMasters = (req) => {
  if (!req.user.permissions.has('masters')) throw forbidden()
}

// Any signed-in user can read masters (they feed form dropdowns); only Store/Admin can change them.
router.get('/:kind', async (req, res) => {
  const cfg = cfgFor(req.params.kind)
  const activeOnly = req.query.active === 'true'
  const { rows } = await query(`SELECT t.* ${cfg.extraSelect || ''} FROM ${cfg.table} t ${activeOnly ? 'WHERE t.is_active' : ''} ORDER BY t.${cfg.order}`)
  res.json({ data: rows.map((r) => toApi(cfg, r)) })
})

router.post('/:kind', async (req, res) => {
  requireMasters(req)
  const cfg = cfgFor(req.params.kind)
  const d = parse(cfg.schema, req.body)
  const cols = Object.keys(cfg.columns)
  const { rows } = await query(
    `INSERT INTO ${cfg.table} (${cols.map((k) => cfg.columns[k]).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    cols.map((k) => d[k] ?? null),
  )
  res.status(201).json(toApi(cfg, await one(`SELECT t.* ${cfg.extraSelect || ''} FROM ${cfg.table} t WHERE id = $1`, [rows[0].id])))
})

router.put('/:kind/:id', async (req, res) => {
  requireMasters(req)
  const cfg = cfgFor(req.params.kind)
  const id = idParam(req.params.id)
  const d = parse(cfg.schema, req.body)
  const cols = Object.keys(cfg.columns)
  const { rowCount } = await query(
    `UPDATE ${cfg.table} SET ${cols.map((k, i) => `${cfg.columns[k]} = $${i + 1}`).join(', ')}, updated_at = now() WHERE id = $${cols.length + 1}`,
    [...cols.map((k) => d[k] ?? null), id],
  )
  if (!rowCount) throw notFound()
  res.json(toApi(cfg, await one(`SELECT t.* ${cfg.extraSelect || ''} FROM ${cfg.table} t WHERE id = $1`, [id])))
})

router.patch('/:kind/:id/active', async (req, res) => {
  requireMasters(req)
  const cfg = cfgFor(req.params.kind)
  const id = idParam(req.params.id)
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body)
  const { rowCount } = await query(`UPDATE ${cfg.table} SET is_active = $1, updated_at = now() WHERE id = $2`, [isActive, id])
  if (!rowCount) throw notFound()
  res.json({ id, isActive })
})

export default router
