import { useState, useEffect } from 'react'
import { ShieldAlert, Save, LogOut } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Button, Card, Field, Input, PageHeader, Select, Table, Badge } from '../components/ui.jsx'

export default function Registers() {
  const { can, toast, activeGate, user } = useAuth()
  
  const metaReq = useApi('/registers/meta')
  const [gate, setGate] = useState(activeGate || 'Gate 1')
  const [subcategory, setSubcategory] = useState('')
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)

  const META = metaReq.data?.registers || []
  const SCHEMA = metaReq.data?.schema || {}

  useEffect(() => {
    if (activeGate) setGate(activeGate)
  }, [activeGate])

  useEffect(() => {
    const available = META.filter((r) => r.gate === gate)
    if (available.length > 0 && !available.find(r => r.subcategory === subcategory)) {
      setSubcategory(available[0].subcategory)
    }
  }, [gate, META, subcategory])

  if (!can('gate_registers')) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="mb-4 text-rose-500" size={64} />
        <h1 className="text-2xl font-bold text-slate-900">Unauthorized Access</h1>
        <p className="mt-2 text-slate-500">You do not have permission to view or manage gate registers.</p>
        <p className="mt-1 text-sm text-slate-400">Please contact the Super Admin if you need access.</p>
      </div>
    )
  }

  const selected = META.find((r) => r.gate === gate && r.subcategory === subcategory) || META.find((r) => r.gate === gate)
  const activeCategory = selected ? selected.category : ''
  const activeSubcategory = selected ? selected.subcategory : ''
  const tableSchema = selected ? SCHEMA[selected.table] : []

  const records = useApi(selected ? `/registers?gate=${encodeURIComponent(gate)}&category=${encodeURIComponent(activeCategory)}&subcategory=${encodeURIComponent(activeSubcategory)}` : null)

  const submitForm = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/registers', { gate, category: activeCategory, subcategory: activeSubcategory, ...f })
      toast('Entry recorded successfully')
      setF({})
      records.reload()
    } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const checkout = async (id) => {
    try {
      await api.post(`/registers/${id}/checkout`, { subcategory: activeSubcategory })
      toast('Exit recorded')
      records.reload()
    } catch (err) { toast(err.message, 'error') }
  }

  if (metaReq.loading) return <div className="p-8 text-center text-slate-500">Loading Configuration...</div>

  // Generate dynamic table columns based on schema + hardcoded ones
  const dynamicColumns = [
    { key: 'created_at', label: 'Date/Time', render: (r) => new Date(r.created_at || r.event_at || r.in_at || r.register_date).toLocaleString() },
    ...(tableSchema || []).filter(c => c.name !== 'remarks' && !c.name.includes('signature')).slice(0, 5).map(c => ({
      key: c.name,
      label: c.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    })),
    { key: 'out_at', label: 'Out Time', render: (r) => r.out_at === undefined ? '' : (r.out_at ? new Date(r.out_at).toLocaleString() : <Badge tone="amber">Inside</Badge>) },
    { key: 'action', label: '', render: (r) => r.out_at === null && <Button size="sm" tone="secondary" icon={LogOut} onClick={() => checkout(r.id)}>Exit</Button> },
  ]

  return (
    <>
      <PageHeader crumbs={['Security', 'Registers']} title={`${gate} Registers`} subtitle="Manage specific registers assigned to this gate." />
      
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card title="Select Gate & Register">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gate">
              <Select value={gate} disabled={user.role === 'security' && (user.gatePermissions?.length || 0) <= 1} onChange={(e) => setGate(e.target.value)} options={user.role === 'admin' ? ['Gate 1', 'Gate 2', 'Gate 3'] : (user.gatePermissions || ['Gate 1', 'Gate 2', 'Gate 3'])} />
            </Field>
            <Field label="Register (Subcategory)">
              <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} options={META.filter((r) => r.gate === gate).map((r) => r.subcategory)} />
            </Field>
          </div>
        </Card>

        <Card title="New Entry">
          <form onSubmit={submitForm} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {(tableSchema || []).map(col => {
                const label = col.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                const type = ['int', 'numeric'].includes(col.type) ? 'number' : (col.type === 'date' ? 'date' : (col.type === 'time' ? 'time' : 'text'))
                if (col.name === 'remarks') return null; // handle separately below
                return (
                  <Field key={col.name} label={label}>
                    <Input type={type} value={f[col.name] || ''} onChange={(e) => setF({ ...f, [col.name]: e.target.value })} />
                  </Field>
                )
              })}
            </div>
            {tableSchema?.find(c => c.name === 'remarks') && (
              <Field label="Remarks">
                <Input value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
              </Field>
            )}
            <div className="flex justify-end">
              <Button type="submit" icon={Save} disabled={busy}>{busy ? 'Recording...' : 'Save Record'}</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card title={`Recent Records: ${activeSubcategory} (${gate})`} pad={false}>
        <div className="w-full overflow-x-auto">
          <Table
            rows={records.data?.data || []}
            empty="No records found for this register"
            columns={dynamicColumns}
          />
        </div>
      </Card>
    </>
  )
}
