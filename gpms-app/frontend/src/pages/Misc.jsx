import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ROLE_LABELS } from '../constants.js'
import { Badge, Button, Card, ErrorState, Field, Input, Loading, PageHeader, Table, fmtDateTime } from '../components/ui.jsx'

const ACTION_LABELS = {
  DIRECT_CREATE: 'Direct create',
  DELETE: 'Delete',
  USER_CREATE: 'User created',
  USER_ROLE_CHANGE: 'Role changed',
  USER_ACTIVATE: 'User activated',
  USER_DEACTIVATE: 'User deactivated',
  PERMISSIONS_CHANGE: 'Permissions changed',
}

export function Audit() {
  const { data, error, reload } = useApi('/audit')
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <>
      <PageHeader crumbs={['Admin', 'Audit Log']} title="Audit Log" subtitle="Every elevated action — who, when, what and why. Entries cannot be edited." />
      <Card pad={false}>
        {!data ? <Loading /> : (
          <Table
            rows={data.data}
            columns={[
              { key: 'at', label: 'When', render: (a) => fmtDateTime(a.at), className: 'whitespace-nowrap' },
              { key: 'actor', label: 'Who' },
              { key: 'action', label: 'Action', render: (a) => <Badge tone={a.action === 'DELETE' || a.action === 'USER_DEACTIVATE' ? 'Rejected' : 'Direct'}>{ACTION_LABELS[a.action] || a.action}</Badge> },
              { key: 'entityRef', label: 'Record', render: (a) => <span className="font-semibold">{a.entityRef}</span> },
              { key: 'reason', label: 'Reason / details', render: (a) => a.reason || (a.details ? <code className="text-xs text-slate-500">{JSON.stringify(a.details)}</code> : '—') },
            ]}
          />
        )}
      </Card>
    </>
  )
}

export function Notifications() {
  const navigate = useNavigate()
  const { data, error, reload } = useApi('/notifications')
  if (error) return <ErrorState error={error} onRetry={reload} />
  const open = async (n) => {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`)
    if (n.link) navigate(n.link)
    else reload()
  }
  return (
    <>
      <PageHeader crumbs={['Notifications']} title="Notifications" subtitle="Status changes on your requests and items awaiting your action." actions={<Button tone="secondary" onClick={() => api.post('/notifications/read-all').then(reload)}>Mark all as read</Button>} />
      <Card pad={false}>
        {!data ? <Loading /> : data.data.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No notifications</div> : data.data.map((n) => (
          <button key={n.id} onClick={() => open(n)} className={`flex w-full items-start gap-3 border-b border-slate-100 px-5 py-3.5 text-left last:border-0 hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/40'}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-slate-300' : 'bg-brand-600'}`} />
            <div className="text-sm">
              <div className={n.isRead ? 'text-slate-600' : 'font-medium text-slate-900'}>{n.message}</div>
              <div className="text-xs text-slate-400">{fmtDateTime(n.at)}</div>
            </div>
          </button>
        ))}
      </Card>
    </>
  )
}

export function Profile() {
  const { user, refreshUser, toast } = useAuth()
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', department: user.department || '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [pwErrors, setPwErrors] = useState({})

  const saveProfile = async () => {
    try {
      await api.patch('/auth/me', { name: f.name, phone: f.phone || null, department: f.department || null })
      await refreshUser()
      setErrors({})
      toast('Profile updated')
    } catch (err) {
      setErrors(err.fields)
      toast(err.message, 'error')
    }
  }

  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) return setPwErrors({ confirm: 'Passwords do not match' })
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
      setPwErrors({})
      toast('Password changed')
    } catch (err) {
      setPwErrors(err.status === 400 && !Object.keys(err.fields).length ? { currentPassword: err.message } : err.fields)
    }
  }

  return (
    <>
      <PageHeader crumbs={['My Profile']} title="My Profile & Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile Details">
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email" hint="Linked to your login — contact the Super Admin to change"><Input readOnly value={user.email} /></Field>
            <Field label="Role"><Input readOnly value={ROLE_LABELS[user.role]} /></Field>
            <Field label="Phone" error={errors.phone}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Department" error={errors.department}><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
            <Button onClick={saveProfile}>Save changes</Button>
          </div>
        </Card>
        <Card title="Change Password">
          <div className="space-y-4">
            <Field label="Current password" required error={pwErrors.currentPassword}><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" required error={pwErrors.newPassword} hint="8+ characters with letters and numbers"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Field label="Confirm new password" required error={pwErrors.confirm}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            <Button onClick={changePassword}>Update password</Button>
          </div>
        </Card>
      </div>
    </>
  )
}
