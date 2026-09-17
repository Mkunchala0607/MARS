import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { api, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { UNITS } from '../constants.js'
import { Badge, Button, Card, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Table, Tabs } from '../components/ui.jsx'

// Field lists follow "Master Data and Tech Stack for MARS.docx". Keys match the API.
const MASTERS = {
  materials: {
    label: 'Material / Item',
    fields: [
      { key: 'code', label: 'Material Code', required: true },
      { key: 'description', label: 'Material Description', required: true },
      { key: 'hsnCode', label: 'HSN/SAC Code' },
      { key: 'uom', label: 'Unit of Measure', options: UNITS, required: true },
      { key: 'category', label: 'Category', options: ['Raw Material', 'Packaging', 'Finished Goods', 'Scrap', 'Spares'], required: true },
      { key: 'defaultRate', label: 'Default Rate (₹)', type: 'number' },
    ],
    columns: ['code', 'description', 'hsnCode', 'uom', 'category', 'defaultRate'],
  },
  vendors: {
    label: 'Vendor',
    fields: [
      { key: 'code', label: 'Vendor Code', required: true },
      { key: 'name', label: 'Vendor Name', required: true },
      { key: 'gstin', label: 'GSTIN', upper: true, hint: 'e.g. 36AABCB1234F1Z5' },
      { key: 'vendorType', label: 'Vendor Type', options: ['Supplier', 'Transporter', 'Logistics'], required: true },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address' },
    ],
    columns: ['code', 'name', 'gstin', 'vendorType', 'contactPerson', 'phone'],
  },
  contractors: {
    label: 'Contractor',
    fields: [
      { key: 'code', label: 'Contractor Code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'firmName', label: 'Firm / Company Name' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'idProof', label: 'ID Proof / License' },
      { key: 'validFrom', label: 'Valid From', type: 'date' },
      { key: 'validTo', label: 'Valid Till', type: 'date', required: true },
    ],
    columns: ['code', 'name', 'firmName', 'contactPerson', 'idProof', 'validTo'],
  },
  'sub-contractors': {
    label: 'Sub-Contractor',
    fields: [
      { key: 'code', label: 'Sub-Contractor Code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'parentContractorId', label: 'Parent Contractor', required: true, lookup: 'contractors' },
      { key: 'phone', label: 'Contact details' },
      { key: 'validFrom', label: 'Valid From', type: 'date' },
      { key: 'validTo', label: 'Valid Till', type: 'date', required: true },
    ],
    columns: ['code', 'name', 'parentContractorName', 'phone', 'validTo'],
  },
  'service-vendors': {
    label: 'Service Vendor',
    fields: [
      { key: 'code', label: 'Service Vendor Code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'serviceType', label: 'Service Type', options: ['AMC', 'Housekeeping', 'Canteen', 'Security', 'Pest Control', 'Other'] },
      { key: 'phone', label: 'Contact details' },
      { key: 'validFrom', label: 'Valid From', type: 'date' },
      { key: 'validTo', label: 'Contract Valid Till', type: 'date', required: true },
    ],
    columns: ['code', 'name', 'serviceType', 'phone', 'validTo'],
  },
}

const COLUMN_LABELS = { parentContractorName: 'Parent Contractor' }

export default function Masters() {
  const { toast } = useAuth()
  const [kind, setKind] = useState('materials')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [errors, setErrors] = useState({})
  const cfg = MASTERS[kind]
  const list = useApi(`/masters/${kind}`)
  const contractors = useApi(kind === 'sub-contractors' ? '/masters/contractors?active=true' : null)
  const rows = (list.data?.data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
  const today = new Date().toISOString().slice(0, 10)

  const save = async () => {
    const body = Object.fromEntries(cfg.fields.map((fl) => [fl.key, edit[fl.key] === '' || edit[fl.key] === undefined ? null : fl.type === 'number' || fl.lookup ? Number(edit[fl.key]) : edit[fl.key]]))
    try {
      await (edit.id ? api.put(`/masters/${kind}/${edit.id}`, body) : api.post(`/masters/${kind}`, body))
      toast(`${cfg.label} ${edit.id ? 'updated' : 'added'}`)
      setEdit(null)
      list.reload()
    } catch (err) {
      setErrors(err.status === 409 ? { code: 'This code already exists' } : err.fields)
      if (err.status !== 409 && !Object.keys(err.fields).length) toast(err.message, 'error')
    }
  }

  const toggle = async (r) => {
    try {
      await api.patch(`/masters/${kind}/${r.id}/active`, { isActive: !r.isActive })
      toast(`${r.name || r.description} ${r.isActive ? 'deactivated' : 'activated'}`)
      list.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader crumbs={['Store', 'Master Data']} title="Master Data" subtitle="Reference lists that feed every gate pass form." actions={<Button icon={Plus} onClick={() => { setErrors({}); setEdit({}) }}>Add {cfg.label}</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-1">
          <Tabs value={kind} onChange={(k) => { setKind(k); setQ('') }} tabs={Object.entries(MASTERS).map(([k, m]) => ({ value: k, label: m.label }))} />
          <div className="w-full pb-2 sm:w-64"><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : (
          <Table
            rows={rows}
            columns={[
              ...cfg.columns.map((c) => ({
                key: c,
                label: COLUMN_LABELS[c] || cfg.fields.find((x) => x.key === c).label,
                render: c === 'validTo' ? (r) => <span className={r.validTo < today ? 'font-medium text-rose-600' : ''}>{r.validTo}{r.validTo < today && ' (expired)'}</span> : undefined,
              })),
              { key: 'isActive', label: 'Status', render: (r) => <Badge>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
              {
                key: 'act',
                label: '',
                render: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" tone="ghost" icon={Pencil} onClick={() => { setErrors({}); setEdit(r) }}>Edit</Button>
                    <Button size="sm" tone="secondary" onClick={() => toggle(r)}>{r.isActive ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal open={!!edit} title={`${edit?.id ? 'Edit' : 'Add'} ${cfg.label}`} onClose={() => setEdit(null)} wide footer={<><Button tone="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {cfg.fields.map((fl) => (
              <Field key={fl.key} label={fl.label} required={fl.required} error={errors[fl.key]} hint={fl.hint}>
                {fl.options ? (
                  <Select placeholder="Select" value={edit[fl.key] ?? ''} onChange={(e) => setEdit({ ...edit, [fl.key]: e.target.value })} options={fl.options} />
                ) : fl.lookup ? (
                  <Select placeholder="Select" value={edit[fl.key] ?? ''} onChange={(e) => setEdit({ ...edit, [fl.key]: e.target.value })} options={(contractors.data?.data || []).map((c) => ({ value: c.id, label: c.name }))} />
                ) : (
                  <Input type={fl.type || 'text'} value={edit[fl.key] ?? ''} onChange={(e) => setEdit({ ...edit, [fl.key]: fl.upper ? e.target.value.toUpperCase() : e.target.value })} />
                )}
              </Field>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
