import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Paperclip, Pencil, Printer, Trash2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { GATE_STATUS_LABELS } from '../constants.js'
import { Badge, Button, Card, ErrorState, Field, Loading, Modal, PageHeader, Textarea, Timeline, fmtDate, fmtDateTime, inr } from '../components/ui.jsx'

export default function PassDetail() {
  const { id } = useParams()
  const { user, can, toast } = useAuth()
  const navigate = useNavigate()
  const { data: p, error, reload, setData } = useApi(`/gate-passes/${id}`)
  const [remarks, setRemarks] = useState('')
  const [delOpen, setDelOpen] = useState(false)
  const [delReason, setDelReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!p) return <Loading />

  const canDecide = can('approvals') && p.status === 'Pending' && !p.deletedAt && p.requester.id !== user.id

  const decide = async (decision) => {
    if (decision === 'Rejected' && !remarks.trim()) return toast('Remarks are required to reject', 'error')
    setBusy(true)
    try {
      setData(await api.post(`/gate-passes/${p.id}/decision`, { decision, remarks: remarks.trim() || null }))
      toast(`${p.passNo} ${decision.toLowerCase()} — requester notified`)
      setRemarks('')
    } catch (err) {
      toast(err.message, 'error')
      reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!delReason.trim()) return toast('Reason for deletion is mandatory', 'error')
    try {
      await api.del(`/gate-passes/${p.id}`, { reason: delReason.trim() })
      setDelOpen(false)
      toast(`${p.passNo} deleted — recorded in audit log`)
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[p.typeLabel, p.passNo]}
        title={p.passNo}
        subtitle={`${p.typeLabel} · raised by ${p.requester.name} on ${fmtDateTime(p.createdAt)}`}
        actions={
          <>
            <Button tone="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
            {p.status === 'Approved' && !p.deletedAt && <Button tone="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>}
            {p.status === 'Rejected' && !p.deletedAt && p.requester.id === user.id && <Button icon={Pencil} to={`/passes/${p.type}/${p.id}/edit`}>Amend & Resubmit</Button>}
            {can('direct') && !p.deletedAt && <Button tone="danger" icon={Trash2} onClick={() => setDelOpen(true)}>Delete</Button>}
          </>
        }
      />

      {p.deletedAt && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Deleted on {fmtDateTime(p.deletedAt)}. Reason: <b>{p.deleteReason}</b>. This pass is not valid for movement.
        </div>
      )}
      {p.status === 'Rejected' && !p.deletedAt && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Rejected by {p.approvedBy}: “{p.decisionRemarks}”
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs tracking-wider text-slate-400 uppercase">Mars International India Pvt. Ltd.</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{p.typeLabel.toUpperCase()}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{p.deletedAt ? 'Deleted' : p.status}</Badge>
                  {p.isDirectEntry && <Badge tone="Direct">Direct Entry</Badge>}
                  <Badge tone="info">{p.direction}</Badge>
                  {p.gateStatus !== 'NotReady' && <Badge tone="neutral">Gate: {GATE_STATUS_LABELS[p.gateStatus]}</Badge>}
                </div>
              </div>
              {p.status === 'Approved' && !p.deletedAt && p.type !== 'STORE' && (
                <div className="text-center">
                  <QRCodeSVG value={`GPMS:${p.passNo}`} size={92} />
                  <div className="mt-1 text-[10px] text-slate-400">Scan at gate</div>
                </div>
              )}
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                [p.type === 'STORE' ? 'Movement' : 'M/S. (Party)', p.partyName],
                p.vendor && ['GSTIN', p.vendor.gstin],
                ['Department', p.department],
                ['Purpose', p.purpose],
                p.type === 'RGP' && ['Expected Return', fmtDate(p.expectedReturnDate)],
                p.type === 'RGP' && ['Returned On', p.returnedAt ? fmtDateTime(p.returnedAt) : 'Not yet returned'],
                p.type === 'INWARD' && ['PO / Reference', p.poNumber],
                p.type === 'INWARD' && ['Inward Date', fmtDate(p.inwardDate)],
                p.type === 'STORE' && ['Movement Type', p.movementType],
                p.type !== 'STORE' && ['Vehicle No.', p.vehicleNo],
                ['Driver', p.driverName],
                [p.type === 'SCRAP' ? 'DC / Invoice No.' : 'Invoice No.', p.invoiceNo],
                p.sealNo && ['Seal No.', p.sealNo],
                p.despatchedThrough && ['Despatched through', p.despatchedThrough],
                p.lrRrNo && ['LR / RR No.', p.lrRrNo],
                p.freightAmount != null && ['Freight', `${p.freightTerms} · ${inr(p.freightAmount)}`],
                p.insurance && ['Insurance', p.insurance],
                p.noOfPackages != null && ['No. of Packages', p.noOfPackages],
                ['Approved by', p.status === 'Approved' ? `${p.approvedBy}${p.decidedAt ? ` · ${fmtDateTime(p.decidedAt)}` : ''}` : '—'],
                p.weighments.length > 0 && ['Weighbridge', p.weighments.map((w) => `${w.slipNo}: net ${w.net} kg (${w.status})`).join('; ')],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-800">{v || '—'}</dd>
                  </div>
                ))}
            </dl>
          </Card>

          <Card title="Material Details" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/70 text-xs text-slate-500 uppercase">
                    <th className="px-5 py-2">#</th><th>Description</th><th>Unit</th><th className="text-right">Qty</th><th className="text-right">Value</th><th className="px-5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100">
                      <td className="px-5 py-2.5">{it.lineNo}</td><td>{it.description}</td><td>{it.uom}</td><td className="text-right">{it.quantity}</td><td className="text-right">{inr(it.approxValue)}</td><td className="px-5 text-slate-500">{it.remarks}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={4} className="px-5 py-3 text-right font-semibold">Total Approx. Value</td><td className="text-right font-bold">{inr(p.totalValue)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            {p.attachments.length > 0 && (
              <div className="no-print flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3 text-sm">
                {p.attachments.map((a) => (
                  <button key={a.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 hover:bg-slate-200" onClick={() => api.download(`/gate-passes/${p.id}/attachments/${a.id}`, a.name).catch((e) => toast(e.message, 'error'))}>
                    <Paperclip size={13} /> {a.name}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="hidden grid-cols-3 gap-6 pt-10 text-center text-xs text-slate-500 print:grid">
            <div className="border-t pt-2">Approved by</div>
            <div className="border-t pt-2">Security (Out)</div>
            <div className="border-t pt-2">Receiver's Signature</div>
          </div>
        </div>

        <div className="no-print space-y-6">
          {canDecide && (
            <Card title="Your Decision">
              <Field label="Remarks" hint="Optional for approval, required for rejection">
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button tone="secondary" icon={X} className="text-rose-600" disabled={busy} onClick={() => decide('Rejected')}>Reject</Button>
                <Button tone="success" icon={Check} disabled={busy} onClick={() => decide('Approved')}>Approve</Button>
              </div>
            </Card>
          )}
          {can('approvals') && p.status === 'Pending' && p.requester.id === user.id && (
            <Card><p className="text-sm text-slate-500">You raised this request, so another approver must review it.</p></Card>
          )}
          <Card title="Approval Timeline">
            <Timeline items={p.timeline} />
            {p.status === 'Pending' && !p.deletedAt && (
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-slate-300" /> Awaiting approval
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={delOpen}
        title={`Delete ${p.passNo}?`}
        onClose={() => setDelOpen(false)}
        footer={<><Button tone="secondary" onClick={() => setDelOpen(false)}>Cancel</Button><Button tone="danger" onClick={remove}>Delete Gate Pass</Button></>}
      >
        <p className="mb-3 text-sm text-slate-600">This is a soft delete: the record is kept, marked invalid for gate movement, and the action is written to the audit log.</p>
        <Field label="Reason for Deletion" required><Textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} /></Field>
      </Modal>
    </>
  )
}
