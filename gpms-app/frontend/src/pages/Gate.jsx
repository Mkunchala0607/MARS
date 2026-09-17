import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, LogIn, LogOut, ScanLine, Undo2, XCircle } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { GATE_STATUS_LABELS } from '../constants.js'
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Table, fmtDate, fmtDateTime } from '../components/ui.jsx'

// Security verification: look up a pass (typed or scanned from its QR), confirm it is approved,
// verify the seal number for sealed outward loads, then record the movement.
export default function Gate() {
  const { toast } = useAuth()
  const [q, setQ] = useState('')
  const [p, setP] = useState(null)
  const [seal, setSeal] = useState('')
  const [note, setNote] = useState('')
  const [sealError, setSealError] = useState('')
  const [busy, setBusy] = useState(false)
  const awaiting = useApi('/gate-passes?gateStatus=AwaitingGate,Exited&status=Approved&limit=200')

  const open = async (term) => {
    setSeal('')
    setNote('')
    setSealError('')
    try {
      setP(await api.get(`/gate-passes/lookup?q=${encodeURIComponent(term)}`))
    } catch (err) {
      setP(null)
      toast(err.message, 'error')
    }
  }

  const record = async (action) => {
    setBusy(true)
    setSealError('')
    try {
      const updated = await api.post(`/gate-passes/${p.id}/gate`, { action, sealNo: seal || undefined, remarks: note || undefined })
      setP(updated)
      toast(`${updated.passNo}: ${GATE_STATUS_LABELS[updated.gateStatus]} recorded`)
      awaiting.reload()
    } catch (err) {
      if (/seal/i.test(err.message)) setSealError(err.message)
      else toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const valid = p && p.status === 'Approved' && !p.deletedAt
  const rows = (awaiting.data?.data || []).filter((x) => x.gateStatus === 'AwaitingGate' || (x.type === 'RGP' && x.gateStatus === 'Exited'))
  const done = p && (['Returned', 'Entered'].includes(p.gateStatus) || (p.gateStatus === 'Exited' && p.type !== 'RGP'))

  return (
    <>
      <PageHeader crumbs={['Security', 'Gate Entry / Exit']} title="Gate Entry / Exit Verification" subtitle="Scan the QR on the gate pass or type the pass / vehicle number." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Verify Gate Pass">
            <form onSubmit={(e) => { e.preventDefault(); q.trim() && open(q.trim()) }} className="flex gap-2">
              <Input autoFocus placeholder="e.g. NRGP-2026-0001 or TS08CD1122" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Gate pass or vehicle number" />
              <Button icon={ScanLine} type="submit">Verify</Button>
            </form>
            <p className="mt-2 text-xs text-slate-400">USB / Bluetooth QR scanners type the code into this box automatically.</p>
          </Card>

          {p && (
            <Card>
              <div className={`flex items-center gap-3 rounded-lg p-4 ${valid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                {valid ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
                <div>
                  <div className="font-bold">{valid ? 'VALID — Approved gate pass' : p.deletedAt ? 'INVALID — Pass deleted' : `NOT ALLOWED — Status: ${p.status}`}</div>
                  <div className="text-sm">{p.passNo} · {p.typeLabel}</div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Party</dt><dd>{p.partyName}</dd>
                <dt className="text-slate-500">Vehicle</dt><dd className="font-semibold">{p.vehicleNo || '—'}</dd>
                <dt className="text-slate-500">Driver</dt><dd>{p.driverName || '—'}</dd>
                <dt className="text-slate-500">Material</dt><dd>{p.items.map((i) => `${i.description} × ${i.quantity} ${i.uom}`).join(', ')}</dd>
                {p.type === 'RGP' && (<><dt className="text-slate-500">Expected return</dt><dd>{fmtDate(p.expectedReturnDate)}</dd></>)}
                <dt className="text-slate-500">Gate status</dt><dd><Badge tone="neutral">{GATE_STATUS_LABELS[p.gateStatus]}</Badge></dd>
              </dl>
              <Link to={`/pass/${p.id}`} className="mt-2 inline-block text-xs text-brand-600 hover:underline">View full pass →</Link>

              {valid && !done && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  {p.sealNo && p.gateStatus === 'AwaitingGate' && (
                    <Field label="Seal No. on vehicle" required hint="Type the seal number you see on the vehicle"><Input value={seal} onChange={(e) => { setSeal(e.target.value); setSealError('') }} /></Field>
                  )}
                  {sealError && (
                    <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert"><AlertTriangle size={18} className="shrink-0" /> {sealError}. Approvers have been alerted.</div>
                  )}
                  <Field label="Security remarks"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                  <div className="flex flex-wrap gap-2">
                    {p.direction === 'Outward' && p.gateStatus === 'AwaitingGate' && <Button icon={LogOut} disabled={busy || (p.sealNo && !seal)} onClick={() => record('exit')}>Allow Exit</Button>}
                    {p.direction === 'Inward' && p.gateStatus === 'AwaitingGate' && <Button icon={LogIn} disabled={busy} onClick={() => record('enter')}>Allow Entry</Button>}
                    {p.type === 'RGP' && p.gateStatus === 'Exited' && <Button tone="success" icon={Undo2} disabled={busy} onClick={() => record('return')}>Mark Returned (Inward)</Button>}
                  </div>
                </div>
              )}
              {done && <p className="mt-4 text-sm text-slate-500">Movement completed.</p>}
            </Card>
          )}
        </div>

        <Card title="Expected at the Gate" className="lg:col-span-3" pad={false}>
          {!awaiting.data ? (
            <Loading />
          ) : (
            <Table
              rows={rows}
              empty="No approved passes waiting"
              onRowClick={(x) => { setQ(x.passNo); open(x.passNo) }}
              columns={[
                { key: 'passNo', label: 'Pass No.', render: (x) => <span className="font-semibold">{x.passNo}</span> },
                { key: 'vehicleNo', label: 'Vehicle' },
                { key: 'partyName', label: 'Party' },
                { key: 'dir', label: 'Expected', render: (x) => (x.gateStatus === 'Exited' ? 'Return (RGP)' : x.direction === 'Inward' ? 'Entry' : 'Exit') },
                {
                  key: 'due',
                  label: 'Due',
                  render: (x) =>
                    x.gateStatus === 'Exited' ? (
                      <span className={x.expectedReturnDate < new Date().toISOString().slice(0, 10) ? 'font-medium text-rose-600' : ''}>{fmtDate(x.expectedReturnDate)}</span>
                    ) : (
                      fmtDateTime(x.decidedAt || x.createdAt)
                    ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  )
}
