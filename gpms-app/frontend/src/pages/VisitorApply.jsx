import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { api } from '../api.js'
import { Badge, Button, Card, Field, Input, Textarea } from '../components/ui.jsx'

const QUESTIONS = [
  ['skinDisease', 'Any infectious SKIN diseases (wounds, boils etc.)?'],
  ['eyeDisease', 'Any infectious EYE diseases?'],
  ['respiratoryDisease', 'Any infectious RESPIRATORY diseases (cold, cough, flu)?'],
  ['allergies', 'Any allergies?'],
  ['typhoidHistory', 'Suffered from Typhoid / Paratyphoid fever?'],
]

const blank = { name: '', contactNo: '', comingFrom: '', hostName: '', purpose: '', laptopDetails: '', health: Object.fromEntries(QUESTIONS.map(([k]) => [k, null])), details: '', gmpAcknowledged: false, signatureName: '' }

// Public screen: visitors reach it by scanning the QR code at the gate. No login.
export default function VisitorApply() {
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [pass, setPass] = useState(null) // { passNo, accessToken, status }
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const anyYes = QUESTIONS.some(([k]) => f.health[k] === true)

  // Poll for the host's decision so the visitor can wait at the desk.
  useEffect(() => {
    if (!pass || pass.status !== 'Pending') return
    const t = setInterval(async () => {
      try {
        const s = await api.get(`/public/visitors/${pass.accessToken}`)
        if (s.status !== 'Pending') setPass((p) => ({ ...p, ...s }))
      } catch {
        /* keep polling */
      }
    }, 10_000)
    return () => clearInterval(t)
  }, [pass])

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!f.name.trim()) er.name = 'Required'
    if (!/^\d{10}$/.test(f.contactNo)) er.contactNo = 'Enter a 10-digit mobile number'
    if (!f.comingFrom.trim()) er.comingFrom = 'Required'
    if (!f.hostName.trim()) er.hostName = 'Required'
    QUESTIONS.forEach(([k]) => f.health[k] === null && (er[`health.${k}`] = 'Please answer'))
    if (anyYes && !f.details.trim()) er['health.details'] = 'Please give brief details'
    if (!f.gmpAcknowledged) er.gmpAcknowledged = 'You must accept the GMP guidelines'
    if (!f.signatureName.trim()) er.signatureName = 'Type your full name as signature'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    try {
      const res = await api.post('/public/visitors', {
        name: f.name, contactNo: f.contactNo, comingFrom: f.comingFrom, hostName: f.hostName, purpose: f.purpose || null, laptopDetails: f.laptopDetails || null,
        health: { ...f.health, details: f.details || null }, gmpAcknowledged: true, signatureName: f.signatureName,
      })
      setPass(res)
    } catch (err) {
      setErrors({ ...err.fields, _: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">M</div>
          <div>
            <div className="font-bold text-slate-900">MARS — Visitor Gate Pass</div>
            <div className="text-xs text-slate-500">Visitor entry & Health Declaration (FORM-1839)</div>
          </div>
          <Link to="/login" className="ml-auto text-sm text-brand-600 hover:underline">Staff login</Link>
        </div>

        {pass ? (
          <Card>
            <div className="py-6 text-center">
              {pass.status === 'Rejected' ? <ShieldAlert className="mx-auto text-rose-500" size={44} /> : pass.status === 'Approved' ? <CheckCircle2 className="mx-auto text-emerald-500" size={44} /> : <Clock className="mx-auto text-amber-500" size={44} />}
              <h2 className="mt-3 text-xl font-bold text-slate-900">Request {pass.passNo}</h2>
              <div className="mt-2"><Badge>{pass.status}</Badge></div>
              <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">
                {pass.status === 'Pending' && `Your request has been sent to ${f.hostName}. Please wait at the security desk — this page updates automatically.`}
                {pass.status === 'Approved' && 'You are approved. Show this screen to the security officer to collect your visitor badge.'}
                {pass.status === 'Rejected' && 'Your entry request was not approved. Please contact your host.'}
              </p>
              {anyYes && pass.status === 'Pending' && <p className="mx-auto mt-3 max-w-sm rounded-lg bg-amber-50 p-3 text-xs text-amber-700">You declared a health condition. Security will inform P&O before a decision is made.</p>}
              <Button tone="secondary" className="mt-6" onClick={() => { setPass(null); setF(blank) }}>New request</Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <Card title="Visitor Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required error={errors.name}><Input autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="Contact No." required error={errors.contactNo}><Input inputMode="numeric" autoComplete="tel" value={f.contactNo} onChange={(e) => set('contactNo', e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
                <Field label="Coming From (Company)" required error={errors.comingFrom}><Input autoComplete="organization" value={f.comingFrom} onChange={(e) => set('comingFrom', e.target.value)} /></Field>
                <Field label="Whom to Meet" required error={errors.hostName} hint="Full name of the MARS employee"><Input value={f.hostName} onChange={(e) => set('hostName', e.target.value)} /></Field>
                <Field label="Purpose" error={errors.purpose}><Input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field>
                <Field label="Laptop (make / serial no.)" hint="Leave blank if none"><Input value={f.laptopDetails} onChange={(e) => set('laptopDetails', e.target.value)} /></Field>
              </div>
            </Card>

            <Card title="Health Declaration — FORM-1839">
              <div className="space-y-3">
                {QUESTIONS.map(([k, text], i) => (
                  <div key={k} className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
                    <div className="text-sm text-slate-700" id={`q-${k}`}>
                      Q{i + 1}. {text}
                      {errors[`health.${k}`] && <span className="ml-2 text-xs text-rose-600">{errors[`health.${k}`]}</span>}
                    </div>
                    <div className="flex gap-2" role="radiogroup" aria-labelledby={`q-${k}`}>
                      {[['No', false], ['Yes', true]].map(([label, val]) => (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={f.health[k] === val}
                          key={label}
                          onClick={() => setF((s) => ({ ...s, health: { ...s.health, [k]: val } }))}
                          className={`rounded-lg px-4 py-1.5 text-sm font-medium ring-1 ${f.health[k] === val ? (val ? 'bg-rose-600 text-white ring-rose-600' : 'bg-emerald-600 text-white ring-emerald-600') : 'bg-white text-slate-600 ring-slate-300'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {anyYes && (
                  <Field label="Brief details" required error={errors['health.details']}>
                    <Textarea value={f.details} onChange={(e) => set('details', e.target.value)} />
                  </Field>
                )}
              </div>
            </Card>

            <Card title="Declaration">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.gmpAcknowledged} onChange={(e) => set('gmpAcknowledged', e.target.checked)} />
                I declare the above information is true, and I will follow MARS Good Manufacturing Practice (GMP) guidelines while on site.
              </label>
              {errors.gmpAcknowledged && <div className="mt-1 text-xs text-rose-600">{errors.gmpAcknowledged}</div>}
              <Field label="Visitor Signature (type full name)" required error={errors.signatureName} className="mt-4">
                <Input value={f.signatureName} onChange={(e) => set('signatureName', e.target.value)} className="font-serif italic" />
              </Field>
            </Card>
            {errors._ && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errors._}</div>}
            <Button type="submit" className="w-full py-3" disabled={busy}>{busy ? 'Submitting…' : 'Apply for Gate Pass'}</Button>
          </form>
        )}
      </div>
    </div>
  )
}
