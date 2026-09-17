import { useState } from 'react'
import { Pencil, UserPlus } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ROLE_LABELS } from '../constants.js'
import { Badge, Button, Card, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Table, fmtDateTime } from '../components/ui.jsx'

export default function Users() {
  const { user: me, toast } = useAuth()
  const list = useApi('/users')
  const vendors = useApi('/masters/vendors?active=true')
  const [edit, setEdit] = useState(null)
  const [errors, setErrors] = useState({})
  const [q, setQ] = useState('')

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  const rows = (list.data?.data || []).filter((u) => !q || `${u.name} ${u.email} ${u.department || ''}`.toLowerCase().includes(q.toLowerCase()))
  const pendingReg = (list.data?.data || []).filter((u) => !u.isActive && u.selfRegistered).length

  const save = async () => {
    const body = { name: edit.name, email: edit.email, role: edit.role, department: edit.department || null, phone: edit.phone || null, vendorId: edit.role === 'vendor' ? Number(edit.vendorId) || null : null }
    try {
      const res = edit.id ? await api.put(`/users/${edit.id}`, body) : await api.post('/users', body)
      toast(edit.id ? 'User updated' : `User created — a set-password link was emailed to ${res.email}`)
      if (res.devInviteLink) console.info('Invite link (development only):', res.devInviteLink)
      setEdit(null)
      list.reload()
    } catch (err) {
      setErrors(err.status === 409 ? { email: 'This email is already registered' } : err.fields)
      if (err.status !== 409 && !Object.keys(err.fields).length) toast(err.message, 'error')
    }
  }

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u.id}/active`, { isActive: !u.isActive })
      toast(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`)
      list.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        crumbs={['Admin', 'Users']}
        title="User Management"
        subtitle={pendingReg ? `${pendingReg} self-registration(s) awaiting activation.` : 'Add users, assign roles and control access.'}
        actions={<Button icon={UserPlus} onClick={() => { setErrors({}); setEdit({ role: 'requester' }) }}>Add User</Button>}
      />
      <Card pad={false}>
        <div className="p-4"><div className="sm:w-72"><Input placeholder="Search name, email, department…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        {!list.data ? <Loading /> : (
          <Table
            rows={rows}
            columns={[
              { key: 'name', label: 'Name', render: (u) => <div className="font-medium text-slate-800">{u.name}<div className="text-xs font-normal text-slate-400">{u.email}</div></div> },
              { key: 'role', label: 'Role', render: (u) => <div><Badge tone="info">{ROLE_LABELS[u.role]}</Badge>{u.vendorName && <div className="mt-0.5 text-xs text-slate-400">{u.vendorName}</div>}</div> },
              { key: 'department', label: 'Department', render: (u) => u.department || '—' },
              { key: 'lastLoginAt', label: 'Last sign-in', render: (u) => (u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never') },
              { key: 'isActive', label: 'Status', render: (u) => (!u.isActive && u.selfRegistered ? <Badge tone="Pending">Awaiting activation</Badge> : <Badge>{u.isActive ? 'Active' : 'Inactive'}</Badge>) },
              {
                key: 'act',
                label: '',
                render: (u) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" tone="ghost" icon={Pencil} onClick={() => { setErrors({}); setEdit(u) }}>Edit</Button>
                    <Button size="sm" tone="secondary" disabled={u.id === me.id} onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <Modal open={!!edit} title={edit?.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)} footer={<><Button tone="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}><Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Work email" required error={errors.email}><Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Role" required error={errors.role}>
              <Select value={edit.role} disabled={edit.id === me.id} onChange={(e) => setEdit({ ...edit, role: e.target.value })} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Department"><Input value={edit.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="Phone"><Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            {edit.role === 'vendor' && (
              <Field label="Linked vendor" required error={errors.vendorId}>
                <Select placeholder="Select vendor" value={edit.vendorId || ''} onChange={(e) => setEdit({ ...edit, vendorId: e.target.value })} options={(vendors.data?.data || []).map((v) => ({ value: v.id, label: v.name }))} />
              </Field>
            )}
            {!edit.id && <p className="text-xs text-slate-500 sm:col-span-2">The user receives an email with a link to set their own password.</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
