import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Button, Field, Input, Modal } from '../components/ui.jsx'

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-bold text-brand-700">M</div>
      <div className="leading-tight">
        <div className="font-bold tracking-wide">MARS</div>
        <div className="text-xs text-white/70">GATE PASS MANAGEMENT</div>
      </div>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-[#23208f] to-brand-500 p-12 text-white lg:flex">
        <Brand />
        <div>
          <h1 className="max-w-md text-4xl leading-tight font-bold">Secure, seamless gate operations — from entry to exit.</h1>
          <p className="mt-4 max-w-md text-white/75">One platform for security officers, plant employees, vendors and visitors to manage gate passes, approvals and weighbridge operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Security Officer', 'Approver', 'Store Person', 'Visitor'].map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/20">{t}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white lg:hidden">M</div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, toast } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [f, setF] = useState({ email: '', password: '', remember: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null)
  const [reg, setReg] = useState({ name: '', email: '', password: '', confirm: '', department: '' })
  const [regErrors, setRegErrors] = useState({})
  const [forgotEmail, setForgotEmail] = useState('')

  const signIn = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(f.email.trim(), f.password, f.remember)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.status === 400 ? 'Enter a valid email and password.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const register = async () => {
    if (reg.password !== reg.confirm) return setRegErrors({ confirm: 'Passwords do not match' })
    try {
      const res = await api.post('/auth/register', { name: reg.name, email: reg.email, password: reg.password, department: reg.department || null })
      setModal(null)
      toast(res.message)
    } catch (err) {
      setRegErrors(err.fields)
      if (!Object.keys(err.fields).length) toast(err.message, 'error')
    }
  }

  const forgot = async () => {
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail })
      setModal(null)
      toast(res.message)
    } catch (err) {
      toast(err.fields.email || err.message, 'error')
    }
  }

  return (
    <Shell>
      <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
      <p className="mt-1 text-sm text-slate-500">Sign in to your MARS GPMS account to continue.</p>
      <form onSubmit={signIn} className="mt-6 space-y-4">
        <Field label="Work email" required>
          <Input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Password" required>
          <Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /> Keep me signed in for 30 days
          </label>
          <button type="button" className="text-brand-600 hover:underline" onClick={() => setModal('forgot')}>Forgot password?</button>
        </div>
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <div className="my-5 text-center text-xs text-slate-400">OR CONTINUE WITH</div>
      <Button tone="secondary" className="w-full" onClick={() => toast('MARS Single Sign-On will be enabled once MARS IT shares the SAML/OAuth2 details', 'info')}>
        Sign in with MARS Single Sign-On
      </Button>
      <div className="mt-4 flex justify-between text-sm">
        <button className="text-brand-600 hover:underline" onClick={() => { setRegErrors({}); setModal('register') }}>New user? Register</button>
        <Link to="/visitor-pass" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><QrCode size={14} /> Visitor? Apply for gate pass</Link>
      </div>

      <Modal open={modal === 'forgot'} title="Reset password" onClose={() => setModal(null)} footer={<Button onClick={forgot}>Send reset link</Button>}>
        <Field label="Registered email" required><Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} /></Field>
      </Modal>

      <Modal open={modal === 'register'} title="New registration" onClose={() => setModal(null)} footer={<Button onClick={register}>Register</Button>}>
        <div className="space-y-3">
          <Field label="Full name" required error={regErrors.name}><Input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} /></Field>
          <Field label="Work email" required error={regErrors.email}><Input type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} /></Field>
          <Field label="Department" error={regErrors.department}><Input value={reg.department} onChange={(e) => setReg({ ...reg, department: e.target.value })} /></Field>
          <Field label="Password" required error={regErrors.password} hint="8+ characters with letters and numbers"><Input type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} /></Field>
          <Field label="Confirm password" required error={regErrors.confirm}><Input type="password" value={reg.confirm} onChange={(e) => setReg({ ...reg, confirm: e.target.value })} /></Field>
          <p className="text-xs text-slate-500">New accounts are End Users and must be activated by a Super Admin.</p>
        </div>
      </Modal>
    </Shell>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useAuth()
  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    if (pw.password !== pw.confirm) return setErrors({ confirm: 'Passwords do not match' })
    try {
      const res = await api.post('/auth/reset-password', { token: params.get('token'), password: pw.password })
      toast(res.message)
      navigate('/login')
    } catch (err) {
      setErrors(err.fields)
      if (!err.fields.password) toast(err.message, 'error')
    }
  }

  return (
    <Shell>
      <h2 className="text-2xl font-bold text-slate-900">Set your password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a password with at least 8 characters, including letters and numbers.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="New password" required error={errors.password}><Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
        <Field label="Confirm password" required error={errors.confirm}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        <Button type="submit" className="w-full">Save password</Button>
      </form>
    </Shell>
  )
}
