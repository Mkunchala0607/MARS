import { useState } from 'react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Card, ErrorState, Loading, PageHeader } from '../components/ui.jsx'

export default function Roles() {
  const { toast, refreshUser } = useAuth()
  const { data, error, reload, setData } = useApi('/roles')
  const [saving, setSaving] = useState(null)

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Loading />

  const toggle = async (role, screen) => {
    const current = data.permissions[role] || []
    const next = current.includes(screen) ? current.filter((s) => s !== screen) : [...current, screen]
    setSaving(`${role}:${screen}`)
    try {
      await api.put(`/roles/${role}/permissions`, { screens: next })
      setData({ ...data, permissions: { ...data.permissions, [role]: next } })
      toast('Permission updated', 'info')
      refreshUser()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <PageHeader crumbs={['Admin', 'Roles & Permissions']} title="Role & Permission Management" subtitle="Tick a box to grant a role access to a screen. Changes apply immediately and are recorded in the audit log." />
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Screen</th>
                {data.roles.map((r) => (
                  <th key={r.code} className="px-3 py-3 text-center text-xs font-semibold text-slate-700">
                    {r.name}
                    <div className="text-[10px] font-normal text-slate-400">{r.userCount} users</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.screens.map((s, i) => (
                <tr key={s.code} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">
                    {(i === 0 || data.screens[i - 1].group !== s.group) && <div className="text-[10px] font-semibold tracking-wide text-brand-600 uppercase">{s.group}</div>}
                    {s.name}
                  </td>
                  {data.roles.map((r) => {
                    const locked = r.code === 'admin' && ['users', 'roles'].includes(s.code)
                    return (
                      <td key={r.code} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          aria-label={`${r.name}: ${s.name}`}
                          disabled={locked || saving !== null}
                          title={locked ? 'Super Admin always keeps user & role management' : ''}
                          checked={(data.permissions[r.code] || []).includes(s.code)}
                          onChange={() => toggle(r.code, s.code)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
