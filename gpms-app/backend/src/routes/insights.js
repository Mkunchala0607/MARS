import { Router } from 'express'
import ExcelJS from 'exceljs'
import { one, query } from '../db.js'
import { requirePermission, seesAll } from '../lib/auth.js'
import { notFound, parse } from '../lib/http.js'
import { PASS_TYPES, idParam, z } from '../lib/validators.js'

export const dashboardRouter = Router()
export const reportsRouter = Router()
export const notificationsRouter = Router()

// ───────── dashboard ─────────
dashboardRouter.get('/', async (req, res) => {
  const u = req.user
  if (!seesAll(u)) {
    const { rows } = await query(`SELECT status, count(*)::int AS n FROM gate_passes WHERE requester_id = $1 AND deleted_at IS NULL GROUP BY status`, [u.id])
    const c = Object.fromEntries(rows.map((r) => [r.status, r.n]))
    return res.json({ kind: 'personal', counts: { total: rows.reduce((s, r) => s + r.n, 0), Pending: c.Pending || 0, Approved: c.Approved || 0, Rejected: c.Rejected || 0 } })
  }
  const stats = await one(`
    SELECT
      (SELECT count(*)::int FROM gate_passes WHERE deleted_at IS NULL AND created_at >= current_date) AS passes_today,
      (SELECT count(*)::int FROM gate_passes WHERE deleted_at IS NULL AND status = 'Pending') AS pending_passes,
      (SELECT count(*)::int FROM visitor_gate_passes WHERE status = 'Pending') AS pending_visitors,
      (SELECT count(*)::int FROM weighbridge_entries WHERE status = 'Pending') AS pending_weighments,
      (SELECT count(*)::int FROM visitor_gate_passes WHERE created_at >= current_date) AS visitors_today,
      (SELECT count(*)::int FROM visitor_gate_passes WHERE in_time IS NOT NULL AND out_time IS NULL) AS visitors_inside,
      (SELECT count(*)::int FROM gate_passes WHERE deleted_at IS NULL AND gate_status = 'AwaitingGate') AS awaiting_gate,
      (SELECT count(*)::int FROM gate_passes gp JOIN rgp_details r ON r.gate_pass_id = gp.id
         WHERE gp.deleted_at IS NULL AND gp.gate_status = 'Exited' AND r.expected_return_date < current_date) AS rgp_overdue`)
  const { rows: activity } = await query(`
    SELECT d::date AS day,
           count(gp.id) FILTER (WHERE gp.gate_pass_type = 'INWARD')::int AS inward,
           count(gp.id) FILTER (WHERE gp.gate_pass_type IN ('NRGP', 'RGP', 'SCRAP'))::int AS outward
      FROM generate_series(current_date - 6, current_date, interval '1 day') d
      LEFT JOIN gate_passes gp ON gp.deleted_at IS NULL AND gp.created_at >= d AND gp.created_at < d + interval '1 day'
     GROUP BY d ORDER BY d`)
  res.json({
    kind: 'operational',
    stats: {
      passesToday: stats.passes_today,
      pendingApprovals: stats.pending_passes + stats.pending_visitors + stats.pending_weighments,
      pendingPasses: stats.pending_passes,
      pendingVisitors: stats.pending_visitors,
      pendingWeighments: stats.pending_weighments,
      visitorsToday: stats.visitors_today,
      visitorsInside: stats.visitors_inside,
      awaitingGate: stats.awaiting_gate,
      rgpOverdue: stats.rgp_overdue,
    },
    activity: activity.map((a) => ({ day: a.day, inward: a.inward, outward: a.outward })),
  })
})

const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() })

dashboardRouter.get('/analytics', requirePermission('analytics'), async (req, res) => {
  const { from, to } = parse(rangeSchema, req.query)
  const range = [from, to]
  const inRange = `gp.deleted_at IS NULL AND gp.created_at >= $1::date AND gp.created_at < ($2::date + interval '1 day')`
  const [byType, turnaround, daily, topParties, visitors] = await Promise.all([
    query(`SELECT gate_pass_type AS type, status, count(*)::int AS n FROM gate_passes gp WHERE ${inRange} GROUP BY 1, 2`, range),
    query(
      `SELECT gate_pass_type AS type, avg(extract(epoch FROM decided_at - created_at) / 3600)::float AS avg_hours, count(*)::int AS decided
         FROM gate_passes gp WHERE ${inRange} AND NOT is_direct_entry AND decided_at IS NOT NULL GROUP BY 1`,
      range,
    ),
    query(
      `SELECT d::date AS day, count(gp.id)::int AS n FROM generate_series($1::date, $2::date, interval '1 day') d
         LEFT JOIN gate_passes gp ON gp.deleted_at IS NULL AND gp.created_at >= d AND gp.created_at < d + interval '1 day' GROUP BY d ORDER BY d`,
      range,
    ),
    query(`SELECT v.name, sum(gp.total_value)::float AS value, count(*)::int AS n FROM gate_passes gp JOIN vendors v ON v.id = gp.vendor_id WHERE ${inRange} GROUP BY v.name ORDER BY value DESC LIMIT 5`, range),
    one(`SELECT count(*)::int AS n FROM visitor_gate_passes WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')`, range),
  ])
  const types = Object.keys(PASS_TYPES).map((t) => {
    const rows = byType.rows.filter((r) => r.type === t)
    const get = (s) => rows.find((r) => r.status === s)?.n || 0
    return { type: t, label: PASS_TYPES[t].label, Pending: get('Pending'), Approved: get('Approved'), Rejected: get('Rejected') }
  })
  const decided = turnaround.rows.reduce((s, r) => s + r.decided, 0)
  res.json({
    byType: types,
    totals: {
      passes: types.reduce((s, t) => s + t.Pending + t.Approved + t.Rejected, 0),
      approved: types.reduce((s, t) => s + t.Approved, 0),
      rejected: types.reduce((s, t) => s + t.Rejected, 0),
      visitors: visitors.n,
      avgTurnaroundHours: decided ? turnaround.rows.reduce((s, r) => s + r.avg_hours * r.decided, 0) / decided : null,
    },
    turnaroundByType: turnaround.rows.map((r) => ({ type: r.type, avgHours: r.avg_hours })),
    daily: daily.rows.map((r) => ({ day: r.day, count: r.n })),
    topParties: topParties.rows,
  })
})

// ───────── reports & export ─────────
const REPORTS = {
  'gate-passes': {
    title: 'Gate Passes',
    sql: `SELECT gp.pass_no, gp.gate_pass_type, gp.created_at, coalesce(v.name, 'Internal') AS party, gp.vehicle_no, gp.invoice_no, gp.total_value,
                 u.name AS requester, CASE WHEN gp.deleted_at IS NOT NULL THEN 'Deleted' ELSE gp.status END AS status, gp.is_direct_entry, gp.gate_status,
                 (SELECT string_agg(description || ' x ' || quantity || ' ' || uom_code, '; ' ORDER BY line_no) FROM gate_pass_items i WHERE i.gate_pass_id = gp.id) AS materials
            FROM gate_passes gp JOIN users u ON u.id = gp.requester_id LEFT JOIN vendors v ON v.id = gp.vendor_id
           WHERE gp.created_at >= $1::date AND gp.created_at < ($2::date + interval '1 day')
             AND ($3::text IS NULL OR gp.gate_pass_type = $3) AND ($4::text IS NULL OR gp.status = $4) AND ($5 OR gp.deleted_at IS NULL)
           ORDER BY gp.created_at DESC`,
    params: (q) => [q.from, q.to, q.type || null, q.status || null, q.includeDeleted === 'true'],
    columns: [
      ['Gate Pass No', 'pass_no', 18], ['Type', (r) => PASS_TYPES[r.gate_pass_type].label, 24], ['Date/Time', 'created_at', 20], ['Party', 'party', 28],
      ['Materials', 'materials', 40], ['Value (INR)', 'total_value', 14], ['Vehicle No', 'vehicle_no', 16], ['Invoice No', 'invoice_no', 16],
      ['Requester', 'requester', 20], ['Status', 'status', 12], ['Direct Entry', (r) => (r.is_direct_entry ? 'Yes' : 'No'), 12], ['Gate Status', 'gate_status', 14],
    ],
  },
  visitors: {
    title: 'Visitors',
    sql: `SELECT v.pass_no, v.visitor_name, v.contact_no, v.coming_from, v.host_name, v.purpose, v.laptop_details, h.has_health_flag, v.status, v.in_time, v.out_time, v.created_at
            FROM visitor_gate_passes v JOIN visitor_health_declarations h ON h.visitor_gate_pass_id = v.id
           WHERE v.created_at >= $1::date AND v.created_at < ($2::date + interval '1 day') AND ($3::text IS NULL OR v.status = $3)
           ORDER BY v.created_at DESC`,
    params: (q) => [q.from, q.to, q.status || null],
    columns: [
      ['Pass No', 'pass_no', 16], ['Name', 'visitor_name', 22], ['Contact', 'contact_no', 14], ['Coming From', 'coming_from', 24], ['Whom to Meet', 'host_name', 20],
      ['Purpose', 'purpose', 24], ['Laptop', 'laptop_details', 18], ['Health Declared', (r) => (r.has_health_flag ? 'Yes' : 'No'), 14], ['Status', 'status', 12],
      ['In Time', 'in_time', 20], ['Out Time', 'out_time', 20],
    ],
  },
  weighments: {
    title: 'Weighments',
    sql: `SELECT w.slip_no, gp.pass_no, v.name AS party, w.vehicle_no, w.in_time, w.out_time, w.gross_weight, w.tare_weight, w.net_weight, w.status
            FROM weighbridge_entries w LEFT JOIN gate_passes gp ON gp.id = w.gate_pass_id LEFT JOIN vendors v ON v.id = gp.vendor_id
           WHERE w.in_time >= $1::date AND w.in_time < ($2::date + interval '1 day') AND ($3::text IS NULL OR w.status = $3)
           ORDER BY w.in_time DESC`,
    params: (q) => [q.from, q.to, q.status || null],
    columns: [
      ['Slip No', 'slip_no', 16], ['Gate Pass', 'pass_no', 18], ['Party', 'party', 28], ['Vehicle', 'vehicle_no', 16], ['In Time', 'in_time', 20], ['Out Time', 'out_time', 20],
      ['Gross (kg)', 'gross_weight', 12], ['Tare (kg)', 'tare_weight', 12], ['Net (kg)', 'net_weight', 12], ['Status', 'status', 12],
    ],
  },
}

const fmtCell = (v) => (v instanceof Date ? v.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : v ?? '')

reportsRouter.get('/:kind', requirePermission('reports'), async (req, res) => {
  const rep = REPORTS[req.params.kind]
  if (!rep) throw notFound('Unknown report')
  const q = parse(
    rangeSchema.extend({ type: z.enum(Object.keys(PASS_TYPES)).optional(), status: z.enum(['Pending', 'Approved', 'Rejected']).optional(), includeDeleted: z.enum(['true', 'false']).optional(), format: z.enum(['json', 'csv', 'xlsx']).default('json') }),
    req.query,
  )
  const { rows } = await query(rep.sql, rep.params(q))
  const value = (r, getter) => fmtCell(typeof getter === 'function' ? getter(r) : r[getter])
  const fname = `GPMS_${rep.title.replace(/\s/g, '_')}_${q.from}_to_${q.to}`

  if (q.format === 'json') return res.json({ columns: rep.columns.map((c) => c[0]), rows: rows.map((r) => rep.columns.map((c) => value(r, c[1]))) })

  if (q.format === 'csv') {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [rep.columns.map((c) => esc(c[0])).join(','), ...rows.map((r) => rep.columns.map((c) => esc(value(r, c[1]))).join(','))].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.csv"`)
    return res.send('﻿' + csv) // BOM so Excel opens UTF-8 (₹, names) correctly
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MARS GPMS'
  const ws = wb.addWorksheet(rep.title)
  ws.columns = rep.columns.map(([header, , width]) => ({ header, width }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D37C4' } }
  rows.forEach((r) => ws.addRow(rep.columns.map((c) => value(r, c[1]))))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ───────── notifications ─────────
notificationsRouter.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, message, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50', [req.user.id])
  const unread = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id])
  res.json({ unread: unread.n, data: rows.map((r) => ({ id: r.id, message: r.message, link: r.link, isRead: r.is_read, at: r.created_at })) })
})

notificationsRouter.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read', [req.user.id])
  res.json({ ok: true })
})

notificationsRouter.post('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [idParam(req.params.id), req.user.id])
  res.json({ ok: true })
})
