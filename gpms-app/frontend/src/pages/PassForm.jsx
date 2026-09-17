import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Paperclip, Plus, Trash2, X, Zap } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { LOCATIONS, PASS_TYPES, UNITS } from '../constants.js'
import { Button, Card, ErrorState, Field, Input, Loading, PageHeader, Select, Textarea, inr } from '../components/ui.jsx'

const STEPS = [
  { title: 'Basic Details', sub: 'Party & purpose' },
  { title: 'Material Details', sub: 'Items & value' },
  { title: 'Vehicle & Transport', sub: 'Dispatch info' },
  { title: 'Attachments', sub: 'Documents' },
  { title: 'Review', sub: 'Submit' },
]

// Which wizard step each server-side field error belongs to.
const FIELD_STEP = { vendorId: 0, purpose: 0, poNumber: 0, expectedReturnDate: 0, fromLocation: 0, toLocation: 0, movementType: 0, freightAmount: 0, items: 1, vehicleNo: 2, driverName: 2, invoiceNo: 2, sealNo: 2, directReason: 4 }
const VEHICLE_RE = /^[A-Z]{2}-?\d{1,2}-?[A-Z]{0,3}-?\d{3,4}$/i
const MAX_MB = 5
const emptyItem = { materialId: '', description: '', uom: 'Nos', quantity: '', approxValue: '', remarks: '' }

const blankForm = (type) => ({
  type, vendorId: '', purpose: '', despatchedThrough: '', lrRrNo: '', freightTerms: 'Paid', freightAmount: '', insurance: 'Arranged', noOfPackages: '',
  poNumber: '', inwardDate: new Date().toISOString().slice(0, 10), expectedReturnDate: '', fromLocation: '', toLocation: '', movementType: 'Issue',
  items: [{ ...emptyItem }], vehicleNo: '', driverName: '', invoiceNo: '', sealNo: '',
})

export default function PassForm() {
  const { type, id } = useParams()
  const [params] = useSearchParams()
  const direct = params.get('direct') === '1'
  const { user, can, toast } = useAuth()
  const navigate = useNavigate()
  const meta = PASS_TYPES[type]
  const isVendor = user.role === 'vendor'

  const vendors = useApi(isVendor || type === 'STORE' ? null : '/masters/vendors?active=true')
  const materials = useApi('/masters/materials?active=true')
  const existing = useApi(id ? `/gate-passes/${id}` : null)

  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(() => blankForm(type))

  useEffect(() => {
    const p = existing.data
    if (!p) return
    setF({
      ...blankForm(type),
      ...Object.fromEntries(Object.entries(p).filter(([k, v]) => k in blankForm(type) && v !== null)),
      vendorId: p.vendor?.id || '',
      items: p.items.map((i) => ({ materialId: i.materialId || '', description: i.description, uom: i.uom, quantity: i.quantity, approxValue: i.approxValue, remarks: i.remarks || '' })),
    })
  }, [existing.data, type])

  if (!meta) return <Card>Unknown gate pass type.</Card>
  if (direct ? !can('direct') : !can(type)) return <Card>You do not have permission to raise this request.</Card>
  if (existing.error) return <ErrorState error={existing.error} />
  if (id && !existing.data) return <Loading />
  if (existing.data && (existing.data.requester.id !== user.id || existing.data.status !== 'Rejected'))
    return <Card>Only your own rejected requests can be amended and resubmitted.</Card>

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setItem = (i, patch) => setF((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))
  const total = f.items.reduce((s, i) => s + Number(i.approxValue || 0), 0)
  const materialList = materials.data?.data || []
  const vendorList = vendors.data?.data || []
  const selectedVendor = vendorList.find((v) => String(v.id) === String(f.vendorId))

  // Client-side checks mirror the API so users get instant feedback; the server re-validates everything.
  const validate = (n) => {
    const e = {}
    if (n === 0) {
      if (type === 'STORE') {
        if (!f.fromLocation) e.fromLocation = 'Required'
        if (!f.toLocation) e.toLocation = 'Required'
        if (f.fromLocation && f.fromLocation === f.toLocation) e.toLocation = 'From and To must differ'
      } else {
        if (!isVendor && !f.vendorId) e.vendorId = 'Select a party'
        if (type === 'INWARD' && !f.poNumber.trim()) e.poNumber = 'PO / reference number is required'
        if (['NRGP', 'RGP', 'SCRAP'].includes(type) && !f.purpose.trim()) e.purpose = 'Required'
        if (type === 'RGP' && !(f.expectedReturnDate > new Date().toISOString().slice(0, 10))) e.expectedReturnDate = 'Must be a future date'
        if (f.freightAmount && isNaN(Number(f.freightAmount))) e.freightAmount = 'Must be numeric'
      }
    }
    if (n === 1)
      f.items.forEach((it, i) => {
        if (!it.description.trim()) e[`items.${i}.description`] = 'Required'
        if (!(Number(it.quantity) > 0)) e[`items.${i}.quantity`] = 'Qty > 0'
        if (it.approxValue === '' || isNaN(Number(it.approxValue)) || Number(it.approxValue) < 0) e[`items.${i}.approxValue`] = 'Numeric'
      })
    if (n === 2 && type !== 'STORE') {
      if (!f.vehicleNo.trim()) e.vehicleNo = 'Vehicle number is required'
      else if (!VEHICLE_RE.test(f.vehicleNo.trim())) e.vehicleNo = 'Format e.g. TS-12-AB-3345'
    }
    if (n === 4 && direct && !reason.trim()) e.directReason = 'A reason is mandatory for direct entries'
    setErrors(e)
    return !Object.keys(e).length
  }

  const payload = () => ({
    ...f,
    vendorId: f.vendorId ? Number(f.vendorId) : null,
    freightAmount: f.freightAmount === '' ? null : Number(f.freightAmount),
    noOfPackages: f.noOfPackages === '' ? null : Number(f.noOfPackages),
    expectedReturnDate: type === 'RGP' ? f.expectedReturnDate : null,
    inwardDate: type === 'INWARD' ? f.inwardDate : null,
    items: f.items.map((it) => ({ ...it, materialId: it.materialId ? Number(it.materialId) : null, quantity: Number(it.quantity), approxValue: Number(it.approxValue) })),
    directReason: direct ? reason : null,
  })

  const submit = async () => {
    for (let i = 0; i < 5; i++) if (!validate(i)) return setStep(i)
    setBusy(true)
    try {
      const saved = existing.data ? await api.put(`/gate-passes/${id}`, payload()) : await api.post('/gate-passes', payload())
      if (files.length) {
        const fd = new FormData()
        files.forEach((file) => fd.append('files', file))
        await api.upload(`/gate-passes/${saved.id}/attachments`, fd).catch((err) => toast(`Saved, but attachments failed: ${err.message}`, 'error'))
      }
      toast(existing.data ? `${saved.passNo} resubmitted for approval` : direct ? `${saved.passNo} created (direct entry, audit logged)` : `${saved.passNo} submitted — awaiting approval`)
      navigate(`/pass/${saved.id}`)
    } catch (err) {
      setErrors(err.fields)
      const firstStep = Math.min(...Object.keys(err.fields).map((k) => FIELD_STEP[k.split('.')[0]] ?? 4), 4)
      if (Object.keys(err.fields).length) setStep(firstStep)
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const addFiles = (list) => {
    const ok = Array.from(list).filter((file) => {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return toast(`${file.name}: only PDF, JPG or PNG`, 'error'), false
      if (file.size > MAX_MB * 1024 * 1024) return toast(`${file.name}: larger than ${MAX_MB} MB`, 'error'), false
      return true
    })
    setFiles((cur) => [...cur, ...ok].slice(0, 10))
  }

  const party = (
    <Field label={type === 'INWARD' ? 'Vendor' : 'M/S. (Party Name)'} required error={errors.vendorId}>
      {isVendor ? (
        <Input readOnly value={`${user.name} (your company)`} />
      ) : (
        <Select placeholder={vendors.loading ? 'Loading…' : 'Select party from Vendor Master'} value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)} options={vendorList.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))} />
      )}
    </Field>
  )
  const gstin = !isVendor && <Field label="Party's GSTIN No." hint="Auto-filled from Vendor Master"><Input readOnly value={selectedVendor?.gstin || ''} /></Field>

  return (
    <>
      <PageHeader
        crumbs={[meta.short, existing.data ? 'Amend' : 'Create']}
        title={`${existing.data ? `Amend ${existing.data.passNo}` : `${direct ? 'Direct' : 'Create'} ${meta.label}`}`}
        subtitle={direct ? 'Elevated access — approved immediately and written to the audit log.' : existing.data ? `Rejected: “${existing.data.decisionRemarks}”. Fix the details and resubmit.` : 'Fields match the existing paper register.'}
        actions={<Button tone="secondary" icon={X} onClick={() => navigate(-1)}>Cancel</Button>}
      />

      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : i <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500'}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : i < step ? 'bg-brand-500' : 'bg-slate-200'}`} />
            </div>
            <div className="mt-1.5 hidden text-xs font-semibold text-slate-700 sm:block">{s.title}</div>
            <div className="hidden text-[11px] text-slate-400 sm:block">{s.sub}</div>
          </li>
        ))}
      </ol>

      <Card title={STEPS[step].title}>
        {step === 0 && type === 'STORE' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From (Ward / Location)" required error={errors.fromLocation}><Select placeholder="Select" value={f.fromLocation} onChange={(e) => set('fromLocation', e.target.value)} options={LOCATIONS} /></Field>
            <Field label="To (Ward / Location)" required error={errors.toLocation}><Select placeholder="Select" value={f.toLocation} onChange={(e) => set('toLocation', e.target.value)} options={LOCATIONS} /></Field>
            <Field label="Movement Type" required error={errors.movementType}><Select value={f.movementType} onChange={(e) => set('movementType', e.target.value)} options={['Issue', 'Transfer', 'Return to Store']} /></Field>
            <Field label="Purpose"><Input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field>
          </div>
        )}

        {step === 0 && type === 'INWARD' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {party}
            {gstin}
            <Field label="PO / Reference Number" required error={errors.poNumber}><Input value={f.poNumber} onChange={(e) => set('poNumber', e.target.value)} /></Field>
            <Field label="Inward Date" required><Input type="date" value={f.inwardDate} onChange={(e) => set('inwardDate', e.target.value)} /></Field>
            <Field label="Remarks" className="sm:col-span-2"><Input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field>
          </div>
        )}

        {step === 0 && ['NRGP', 'RGP', 'SCRAP'].includes(type) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {party}
            {gstin}
            <Field label="Purpose of being sent out" required error={errors.purpose} className="sm:col-span-2"><Input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field>
            {type === 'RGP' && (
              <>
                <Field label="Expected Return Date" required error={errors.expectedReturnDate}><Input type="date" value={f.expectedReturnDate} onChange={(e) => set('expectedReturnDate', e.target.value)} /></Field>
                <Field label="R.G.P No." hint="System-generated on submit"><Input readOnly value={existing.data?.passNo || 'Auto'} /></Field>
              </>
            )}
            <Field label="Despatched through" hint="Transporter name"><Input value={f.despatchedThrough} onChange={(e) => set('despatchedThrough', e.target.value)} /></Field>
            <Field label="LR / RR No."><Input value={f.lrRrNo} onChange={(e) => set('lrRrNo', e.target.value)} /></Field>
            <Field label="Freight" error={errors.freightAmount}>
              <div className="flex gap-2">
                <div className="w-32"><Select value={f.freightTerms} onChange={(e) => set('freightTerms', e.target.value)} options={['Paid', 'To Pay']} /></div>
                <Input placeholder="Amount ₹" inputMode="decimal" value={f.freightAmount} onChange={(e) => set('freightAmount', e.target.value)} />
              </div>
            </Field>
            <Field label="Insurance"><Select value={f.insurance} onChange={(e) => set('insurance', e.target.value)} options={['Arranged', 'To be arranged']} /></Field>
            <Field label="No. of Packages"><Input type="number" min="0" value={f.noOfPackages} onChange={(e) => set('noOfPackages', e.target.value)} /></Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-3 flex justify-end">
              <Button tone="secondary" size="sm" icon={Plus} disabled={f.items.length >= 50} onClick={() => set('items', [...f.items, { ...emptyItem }])}>Add Item</Button>
            </div>
            <div className="space-y-3">
              {f.items.map((it, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12 sm:items-start">
                  <div className="text-xs font-semibold text-slate-400 sm:col-span-12">Item {i + 1}</div>
                  <Field label="Material (from master)" className="sm:col-span-4">
                    <Select
                      placeholder="— or type a description →"
                      value={it.materialId}
                      onChange={(e) => {
                        const m = materialList.find((x) => String(x.id) === e.target.value)
                        setItem(i, m ? { materialId: m.id, description: m.description, uom: m.uom, approxValue: m.defaultRate && it.quantity ? m.defaultRate * Number(it.quantity) : it.approxValue } : { materialId: '' })
                      }}
                      options={materialList.map((m) => ({ value: m.id, label: `${m.code} — ${m.description}` }))}
                    />
                  </Field>
                  <Field label="Description of Material" required error={errors[`items.${i}.description`]} className="sm:col-span-4"><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></Field>
                  <Field label="Unit" required className="sm:col-span-1"><Select value={it.uom} onChange={(e) => setItem(i, { uom: e.target.value })} options={UNITS} /></Field>
                  <Field label="Qty" required error={errors[`items.${i}.quantity`]} className="sm:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => {
                        const m = materialList.find((x) => x.id === Number(it.materialId))
                        setItem(i, { quantity: e.target.value, ...(m?.defaultRate ? { approxValue: m.defaultRate * Number(e.target.value || 0) } : {}) })
                      }}
                    />
                  </Field>
                  <Field label="Approx. Value (₹)" required error={errors[`items.${i}.approxValue`]} className="sm:col-span-2"><Input type="number" min="0" step="any" value={it.approxValue} onChange={(e) => setItem(i, { approxValue: e.target.value })} /></Field>
                  <Field label="Remarks" className="sm:col-span-11"><Input value={it.remarks} onChange={(e) => setItem(i, { remarks: e.target.value })} /></Field>
                  <div className="flex items-end sm:col-span-1 sm:h-full sm:justify-end">
                    {f.items.length > 1 && (
                      <button className="rounded p-2 text-rose-500 hover:bg-rose-50" onClick={() => set('items', f.items.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right text-sm text-slate-500">Total Approx. Value <span className="ml-2 text-xl font-bold text-slate-900">{inr(total)}</span></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle No." required={type !== 'STORE'} error={errors.vehicleNo} hint="e.g. TS-12-AB-3345"><Input value={f.vehicleNo} onChange={(e) => set('vehicleNo', e.target.value.toUpperCase())} /></Field>
            <Field label="Driver Name"><Input value={f.driverName} onChange={(e) => set('driverName', e.target.value)} /></Field>
            <Field label={type === 'SCRAP' ? 'DC / Invoice No.' : 'Invoice No.'}><Input value={f.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} /></Field>
            {['NRGP', 'SCRAP'].includes(type) && (
              <Field label="Seal No." hint="Security verifies this at the gate before exit"><Input value={f.sealNo} onChange={(e) => set('sealNo', e.target.value)} /></Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-brand-400 hover:bg-brand-50/30">
              <Paperclip className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Click to attach Invoice / DC / Photos</span>
              <span className="text-xs text-slate-400">PDF, JPG or PNG · up to {MAX_MB} MB each · max 10 files</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            {existing.data?.attachments.length > 0 && <p className="mt-3 text-xs text-slate-500">Already attached: {existing.data.attachments.map((a) => a.name).join(', ')}</p>}
            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><Paperclip size={14} /> {file.name} <span className="text-xs text-slate-400">({Math.ceil(file.size / 1024)} KB)</span></span>
                    <button className="text-rose-500" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 text-sm">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {[
                ['Type', meta.label],
                type === 'STORE' ? ['Movement', `${f.fromLocation} → ${f.toLocation} (${f.movementType})`] : ['Party', isVendor ? user.name : selectedVendor?.name],
                type !== 'STORE' && !isVendor && ['GSTIN', selectedVendor?.gstin],
                ['Purpose', f.purpose],
                type === 'RGP' && ['Expected Return', f.expectedReturnDate],
                type === 'INWARD' && ['PO / Reference', f.poNumber],
                type !== 'STORE' && ['Vehicle No.', f.vehicleNo],
                ['Driver', f.driverName],
                ['Invoice No.', f.invoiceNo],
                f.sealNo && ['Seal No.', f.sealNo],
                ['Attachments', files.length ? files.map((x) => x.name).join(', ') : 'None'],
                ['Approved by', direct ? `${user.name} (Direct Entry)` : 'Blank until Approver acts'],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-800">{v || '—'}</dd>
                  </div>
                ))}
            </dl>
            <table className="w-full text-left">
              <thead><tr className="border-b text-xs text-slate-500 uppercase"><th className="py-2">#</th><th>Description</th><th>Unit</th><th className="text-right">Qty</th><th className="text-right">Value</th></tr></thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100"><td className="py-2">{i + 1}</td><td>{it.description}</td><td>{it.uom}</td><td className="text-right">{it.quantity}</td><td className="text-right">{inr(it.approxValue)}</td></tr>
                ))}
                <tr><td colSpan={4} className="py-2 text-right font-semibold">Total</td><td className="text-right font-bold">{inr(total)}</td></tr>
              </tbody>
            </table>
            {direct && (
              <Field label="Reason for direct entry" required error={errors.directReason} hint="Written to the audit log with your name and time">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Card>

      <div className="mt-5 flex justify-between">
        <Button tone="secondary" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 4 ? (
          <Button onClick={() => validate(step) && setStep(step + 1)}>Continue <ArrowRight size={16} /></Button>
        ) : (
          <Button tone={direct ? 'success' : 'primary'} icon={direct ? Zap : Check} disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : existing.data ? 'Resubmit for Approval' : direct ? 'Create Gate Pass (Direct)' : 'Submit for Approval'}
          </Button>
        )}
      </div>
    </>
  )
}
