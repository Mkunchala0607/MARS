import { useState } from 'react'
import { Scale } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Select, Table, fmtDateTime } from '../components/ui.jsx'

const blank = { gatePassId: '', slipNo: '', invoiceNo: '', inTime: '', outTime: '', grossWeight: '', tareWeight: '' }
const toIso = (local) => (local ? new Date(local).toISOString() : null)

export default function Weighbridge() {
  const { toast } = useAuth()
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const passes = useApi('/gate-passes?status=Approved&limit=200')
  const entries = useApi('/weighbridge')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const weighed = new Set((entries.data?.data || []).filter((w) => w.status !== 'Rejected').map((w) => w.gatePassId))
  const linkable = (passes.data?.data || []).filter((p) => p.type !== 'STORE' && !weighed.has(p.id))
  const linked = linkable.find((p) => String(p.id) === String(f.gatePassId))
  const net = f.grossWeight !== '' && f.tareWeight !== '' ? Number(f.grossWeight) - Number(f.tareWeight) : ''

  const submit = async () => {
    const e = {}
    if (!f.gatePassId) e.gatePassId = 'Link a gate pass'
    if (!f.slipNo.trim()) e.slipNo = 'Required'
    if (!f.inTime) e.inTime = 'Required'
    if (!(Number(f.grossWeight) > 0)) e.grossWeight = 'Enter gross weight'
    if (!(Number(f.tareWeight) > 0)) e.tareWeight = 'Enter tare weight'
    else if (net !== '' && net <= 0) e.tareWeight = 'Tare must be less than gross'
    if (f.outTime && f.inTime && f.outTime < f.inTime) e.outTime = 'Out time must be after in time'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const w = await api.post('/weighbridge', {
        gatePassId: Number(f.gatePassId), slipNo: f.slipNo.trim(), invoiceNo: f.invoiceNo || null, inTime: toIso(f.inTime), outTime: toIso(f.outTime),
        grossWeight: Number(f.grossWeight), tareWeight: Number(f.tareWeight),
      })
      toast(`Weighment ${w.slipNo} submitted (net ${w.net} kg) — awaiting approval`)
      setF(blank)
      entries.reload()
    } catch (err) {
      setErrors(err.fields)
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumbs={['Store', 'Weighbridge']} title="Weighbridge Entry" subtitle="Matches the Outward Warehouse Weighment Register. Net weight is calculated automatically." />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked Gate Pass No." required error={errors.gatePassId}>
            <Select placeholder={passes.loading ? 'Loading…' : 'Select approved gate pass'} value={f.gatePassId} onChange={(e) => setF((s) => ({ ...s, gatePassId: e.target.value, invoiceNo: linkable.find((p) => String(p.id) === e.target.value)?.invoiceNo || s.invoiceNo }))} options={linkable.map((p) => ({ value: p.id, label: `${p.passNo} — ${p.vehicleNo || ''}` }))} />
          </Field>
          <Field label="Party Name" hint="From the linked gate pass"><Input readOnly value={linked?.partyName || ''} /></Field>
          <Field label="Description of Material"><Input readOnly value={linked?.firstItem || ''} /></Field>
          <Field label="Vehicle No."><Input readOnly value={linked?.vehicleNo || ''} /></Field>
          <Field label="Invoice No."><Input value={f.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} /></Field>
          <Field label="Slip No." required error={errors.slipNo}><Input value={f.slipNo} onChange={(e) => set('slipNo', e.target.value)} /></Field>
        </div>
        <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="In Time" required error={errors.inTime}><Input type="datetime-local" value={f.inTime} onChange={(e) => set('inTime', e.target.value)} /></Field>
          <Field label="Out Time" error={errors.outTime}><Input type="datetime-local" value={f.outTime} onChange={(e) => set('outTime', e.target.value)} /></Field>
          <Field label="Gross Wt. (Kg)" required error={errors.grossWeight}><Input type="number" min="0" step="any" value={f.grossWeight} onChange={(e) => set('grossWeight', e.target.value)} /></Field>
          <Field label="Tare Wt. (Kg)" required error={errors.tareWeight}><Input type="number" min="0" step="any" value={f.tareWeight} onChange={(e) => set('tareWeight', e.target.value)} /></Field>
          <Field label="Net Wt. (Kg)" hint="Auto-calculated"><Input readOnly value={net} className="font-bold" /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button icon={Scale} disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit Weighment'}</Button>
        </div>
      </Card>

      <Card title="Weighment Register" className="mt-6" pad={false}>
        {!entries.data ? (
          <Loading />
        ) : (
          <Table
            rows={entries.data.data}
            columns={[
              { key: 'slipNo', label: 'Slip No.', render: (w) => <span className="font-semibold">{w.slipNo}</span> },
              { key: 'gatePassNo', label: 'Gate Pass' },
              { key: 'partyName', label: 'Party' },
              { key: 'vehicleNo', label: 'Vehicle' },
              { key: 'inTime', label: 'In', render: (w) => fmtDateTime(w.inTime), className: 'whitespace-nowrap' },
              { key: 'gross', label: 'Gross', className: 'text-right' },
              { key: 'tare', label: 'Tare', className: 'text-right' },
              { key: 'net', label: 'Net (Kg)', render: (w) => <b>{w.net}</b>, className: 'text-right' },
              { key: 'status', label: 'Status', render: (w) => <Badge>{w.status}</Badge> },
            ]}
          />
        )}
      </Card>
    </>
  )
}
