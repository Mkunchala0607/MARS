import { useState } from 'react'
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { api, qs, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { PASS_TYPES, daysAgo, today } from '../constants.js'
import { Button, Card, ErrorState, Field, Input, Loading, PageHeader, Select, Tabs } from '../components/ui.jsx'

export default function Reports() {
  const { toast } = useAuth()
  const [report, setReport] = useState('gate-passes')
  const [filters, setFilters] = useState({ from: daysAgo(30), to: today(), type: '', status: '', includeDeleted: '' })
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  const params = { ...filters, type: report === 'gate-passes' ? filters.type : '', includeDeleted: report === 'gate-passes' ? filters.includeDeleted : '' }
  const data = useApi(`/reports/${report}${qs(params)}`)

  const exportAs = (format) => api.download(`/reports/${report}${qs({ ...params, format })}`, `GPMS_${report}.${format}`).catch((e) => toast(e.message, 'error'))

  return (
    <>
      <PageHeader
        crumbs={['Store', 'Reports & Export']}
        title="Reports & Data Export"
        subtitle="Filter records and export for MIS, audits or offline analysis."
        actions={
          <>
            <Button tone="secondary" icon={FileDown} onClick={() => exportAs('csv')}>CSV</Button>
            <Button tone="secondary" icon={FileSpreadsheet} onClick={() => exportAs('xlsx')}>Excel</Button>
            <Button tone="secondary" icon={Printer} onClick={() => window.print()}>PDF</Button>
          </>
        }
      />
      <Card className="no-print mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From"><Input type="date" value={filters.from} max={filters.to} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={filters.to} min={filters.from} onChange={(e) => set('to', e.target.value)} /></Field>
          {report === 'gate-passes' && <Field label="Type"><Select placeholder="All types" value={filters.type} onChange={(e) => set('type', e.target.value)} options={Object.entries(PASS_TYPES).map(([k, v]) => ({ value: k, label: v.label }))} /></Field>}
          <Field label="Status"><Select placeholder="All statuses" value={filters.status} onChange={(e) => set('status', e.target.value)} options={['Pending', 'Approved', 'Rejected']} /></Field>
          {report === 'gate-passes' && (
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
              <input type="checkbox" checked={filters.includeDeleted === 'true'} onChange={(e) => set('includeDeleted', e.target.checked ? 'true' : '')} /> Include deleted
            </label>
          )}
        </div>
      </Card>
      <Card pad={false}>
        <div className="no-print px-5 pt-1">
          <Tabs value={report} onChange={setReport} tabs={[{ value: 'gate-passes', label: 'Gate Passes' }, { value: 'visitors', label: 'Visitors' }, { value: 'weighments', label: 'Weighments' }]} />
        </div>
        {data.error ? (
          <ErrorState error={data.error} onRetry={data.reload} />
        ) : !data.data ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <div className="px-5 py-2 text-xs text-slate-500">{data.data.rows.length} record(s)</div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 uppercase">
                  {data.data.columns.map((c) => <th key={c} className="px-4 py-2.5 font-medium whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.data.rows.length === 0 && <tr><td colSpan={data.data.columns.length} className="px-4 py-10 text-center text-slate-400">No records for these filters</td></tr>}
                {data.data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {r.map((v, j) => <td key={j} className="px-4 py-2.5">{typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('en-IN') : String(v ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
