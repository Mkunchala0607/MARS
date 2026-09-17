import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, CheckCheck, X } from 'lucide-react'
import { api, qs, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Badge, Button, Card, ErrorState, Field, Loading, PageHeader, Tabs, Textarea, Timeline, fmtDateTime, inr } from '../components/ui.jsx'

const timeAgo = (iso) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000))
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hrs ago` : `${Math.round(m / 1440)} days ago`
}

function DecisionButtons({ onDecide, busy }) {
  const [remarks, setRemarks] = useState('')
  return (
    <>
      <Field label="Remarks (optional for approval, required for rejection)" className="mt-4">
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="secondary" icon={X} className="text-rose-600" disabled={busy} onClick={() => onDecide('Rejected', remarks, () => setRemarks(''))}>Reject</Button>
        <Button tone="success" icon={Check} disabled={busy} onClick={() => onDecide('Approved', remarks, () => setRemarks(''))}>Approve</Button>
      </div>
    </>
  )
}

function PassQueue({ onChanged }) {
  const { user, toast } = useAuth()
  const [tab, setTab] = useState('Pending')
  const [selectedId, setSelectedId] = useState(null)
  const [checked, setChecked] = useState([])
  const [busy, setBusy] = useState(false)
  const list = useApi(`/gate-passes${qs({ status: tab, limit: 200 })}`)
  const rows = list.data?.data || []
  const selected = rows.find((p) => p.id === selectedId) || rows[0]
  const detail = useApi(selected ? `/gate-passes/${selected.id}` : null)
  const mine = (p) => p.requester.id === user.id

  const decide = async (decision, remarks, clear) => {
    if (decision === 'Rejected' && !remarks.trim()) return toast('Remarks are required to reject a request', 'error')
    setBusy(true)
    try {
      await api.post(`/gate-passes/${selected.id}/decision`, { decision, remarks: remarks.trim() || null })
      toast(`${selected.passNo} ${decision.toLowerCase()} — requester notified`)
      clear()
      setSelectedId(null)
      list.reload()
      onChanged()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const bulk = async () => {
    setBusy(true)
    try {
      await api.post('/gate-passes/decisions/bulk', { ids: checked })
      toast(`${checked.length} request(s) approved`)
      setChecked([])
      list.reload()
      onChanged()
    } catch (err) {
      toast(`${err.message}. No requests were approved.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const counts = list.data?.counts || {}
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3" pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-1">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSelectedId(null); setChecked([]) }} tabs={['Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s, count: counts[s] }))} />
          {tab === 'Pending' && <Button size="sm" tone="secondary" icon={CheckCheck} disabled={!checked.length || busy} onClick={bulk}>Bulk Approve{checked.length ? ` (${checked.length})` : ''}</Button>}
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : rows.length === 0 && <div className="p-10 text-center text-sm text-slate-400">Nothing here 🎉</div>}
        {rows.map((p) => (
          <div key={p.id} onClick={() => setSelectedId(p.id)} className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-5 py-3.5 last:border-0 ${selected?.id === p.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}>
            {tab === 'Pending' && (
              <input
                type="checkbox"
                className="h-4 w-4"
                disabled={mine(p)}
                title={mine(p) ? 'You cannot approve your own request' : ''}
                checked={checked.includes(p.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => setChecked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))}
                aria-label={`Select ${p.passNo}`}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">{p.passNo}</div>
              <div className="truncate text-xs text-slate-500">{p.requester.name} · {p.partyName} · {inr(p.totalValue)}</div>
            </div>
            <div className="text-right">
              <Badge>{p.status}</Badge>
              <div className="mt-1 text-xs text-slate-400">{timeAgo(p.createdAt)}</div>
            </div>
          </div>
        ))}
      </Card>

      <div className="lg:col-span-2">
        {!selected ? (
          <Card><div className="py-10 text-center text-sm text-slate-400">Select a request to review</div></Card>
        ) : !detail.data ? (
          <Card><Loading /></Card>
        ) : (
          <Card title={detail.data.passNo} actions={<Badge>{detail.data.status}</Badge>}>
            <dl className="space-y-2 text-sm">
              {[
                ['Type', detail.data.typeLabel],
                ['Requested By', `${detail.data.requester.name}${detail.data.department ? ` (${detail.data.department})` : ''}`],
                [detail.data.type === 'STORE' ? 'Movement' : 'Vendor / Party', detail.data.partyName],
                ['Purpose', detail.data.purpose],
                detail.data.type === 'RGP' && ['Expected Return', detail.data.expectedReturnDate],
                detail.data.type === 'INWARD' && ['PO No.', detail.data.poNumber],
                detail.data.type !== 'STORE' && ['Vehicle', detail.data.vehicleNo],
                ['Items', detail.data.items.map((i) => `${i.description} × ${i.quantity} ${i.uom}`).join('; ')],
                ['Amount', inr(detail.data.totalValue)],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium text-slate-800">{v || '—'}</dd>
                  </div>
                ))}
            </dl>
            <Link to={`/pass/${detail.data.id}`} className="mt-2 inline-block text-xs text-brand-600 hover:underline">Open full gate pass →</Link>
            <div className="mt-5 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Approval Timeline</div>
            <Timeline items={detail.data.timeline} />
            {detail.data.status === 'Pending' && (mine(detail.data) ? <p className="mt-4 text-sm text-slate-500">You raised this request, so another approver must review it.</p> : <DecisionButtons key={detail.data.id} onDecide={decide} busy={busy} />)}
          </Card>
        )}
      </div>
    </div>
  )
}

function VisitorQueue({ onChanged }) {
  const { toast } = useAuth()
  const list = useApi('/visitors?status=Pending')
  const [busy, setBusy] = useState(false)
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  const decide = (v) => async (decision, remarks, clear) => {
    if (decision === 'Rejected' && !remarks.trim()) return toast('Remarks are required to reject', 'error')
    setBusy(true)
    try {
      await api.post(`/visitors/${v.id}/decision`, { decision, remarks: remarks.trim() || null })
      toast(`Visitor ${v.name} ${decision.toLowerCase()}`)
      clear()
      list.reload()
      onChanged()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  if (!list.data.data.length) return <Card><div className="py-8 text-center text-sm text-slate-400">No pending visitor requests</div></Card>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.data.data.map((v) => (
        <Card key={v.id} title={`${v.passNo} — ${v.name}`} actions={v.health.hasFlag ? <Badge tone="Rejected"><AlertTriangle size={12} /> Health flag</Badge> : <Badge tone="Approved">Declaration clear</Badge>}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Company</dt><dd>{v.comingFrom}</dd>
            <dt className="text-slate-500">Whom to meet</dt><dd>{v.hostName}</dd>
            <dt className="text-slate-500">Purpose</dt><dd>{v.purpose || '—'}</dd>
            <dt className="text-slate-500">Contact</dt><dd>{v.contactNo}</dd>
            <dt className="text-slate-500">Laptop</dt><dd>{v.laptopDetails || '—'}</dd>
            <dt className="text-slate-500">Requested</dt><dd>{fmtDateTime(v.createdAt)}</dd>
          </dl>
          {v.health.hasFlag && (
            <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <b>Declared:</b> {v.health.details} — per GMP rules, inform P&O; entry to production areas should be denied.
            </div>
          )}
          <DecisionButtons onDecide={decide(v)} busy={busy} />
        </Card>
      ))}
    </div>
  )
}

function WeighmentQueue({ onChanged }) {
  const { toast } = useAuth()
  const list = useApi('/weighbridge?status=Pending')
  const [busy, setBusy] = useState(false)
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  const decide = (w) => async (decision, remarks, clear) => {
    if (decision === 'Rejected' && !remarks.trim()) return toast('Remarks are required to reject', 'error')
    setBusy(true)
    try {
      await api.post(`/weighbridge/${w.id}/decision`, { decision, remarks: remarks.trim() || null })
      toast(`Weighment ${w.slipNo} ${decision.toLowerCase()}`)
      clear()
      list.reload()
      onChanged()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  if (!list.data.data.length) return <Card><div className="py-8 text-center text-sm text-slate-400">No pending weighments</div></Card>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.data.data.map((w) => (
        <Card key={w.id} title={`${w.slipNo} · ${w.gatePassNo}`}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Party</dt><dd>{w.partyName || '—'}</dd>
            <dt className="text-slate-500">Material</dt><dd>{w.material || '—'}</dd>
            <dt className="text-slate-500">Vehicle</dt><dd>{w.vehicleNo}</dd>
            <dt className="text-slate-500">Gross / Tare</dt><dd>{w.gross} / {w.tare} kg</dd>
            <dt className="text-slate-500">Net Weight</dt><dd className="font-bold">{w.net} kg</dd>
            <dt className="text-slate-500">Recorded by</dt><dd>{w.recordedBy}</dd>
          </dl>
          <DecisionButtons onDecide={decide(w)} busy={busy} />
        </Card>
      ))}
    </div>
  )
}

export default function Approvals() {
  const [kind, setKind] = useState('passes')
  const [changes, setChanges] = useState(0)
  const dash = useApi('/dashboard', `${kind}-${changes}`)
  const onChanged = () => setChanges((c) => c + 1)
  const s = dash.data?.stats
  return (
    <>
      <PageHeader crumbs={['Approvals']} title="Pending Approvals" subtitle="Review gate passes, visitor requests and weighments awaiting your decision." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['passes', 'Gate Passes', s?.pendingPasses],
          ['visitors', 'Visitors', s?.pendingVisitors],
          ['weigh', 'Weighbridge', s?.pendingWeighments],
        ].map(([k, l, n]) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${kind === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {l}{n !== undefined ? ` (${n})` : ''}
          </button>
        ))}
      </div>
      {kind === 'passes' && <PassQueue onChanged={onChanged} />}
      {kind === 'visitors' && <VisitorQueue onChanged={onChanged} />}
      {kind === 'weigh' && <WeighmentQueue onChanged={onChanged} />}
    </>
  )
}
