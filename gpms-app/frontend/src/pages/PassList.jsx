import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { qs, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { PASS_TYPES } from '../constants.js'
import { Badge, Button, Card, ErrorState, Input, Loading, PageHeader, Stat, Table, Tabs, fmtDateTime, inr } from '../components/ui.jsx'

const PAGE = 50

export default function PassList() {
  const { type } = useParams()
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('All')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(0)
  const meta = PASS_TYPES[type]

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const path = `/gate-passes${qs({ type, status: tab === 'All' ? '' : tab, q: term, limit: PAGE, offset: page * PAGE })}`
  const { data, error, loading, reload } = useApi(meta ? path : null)

  if (!meta) return <Card>Unknown gate pass type.</Card>
  const seeAll = ['approver', 'security', 'store', 'admin'].includes(user.role)
  const counts = data?.counts || {}

  return (
    <>
      <PageHeader
        crumbs={[meta.short]}
        title={`${meta.short} Register`}
        subtitle={seeAll ? 'All requests across the plant.' : 'Requests you have raised.'}
        actions={can(type) && <Button icon={Plus} to={`/passes/${type}/new`}>New {meta.short}</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={counts.total ?? '—'} />
        <Stat label="Pending" value={counts.Pending ?? '—'} tone="text-amber-600" />
        <Stat label="Approved" value={counts.Approved ?? '—'} tone="text-emerald-600" />
        <Stat label="Rejected" value={counts.Rejected ?? '—'} tone="text-rose-600" />
      </div>
      <Card className="mt-6" pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-2">
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(0) }} tabs={['All', 'Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s }))} />
          <div className="w-full pb-2 sm:w-72">
            <Input placeholder="Search pass no., party, vehicle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : (
          <>
            <Table
              rows={data.data}
              onRowClick={(p) => navigate(`/pass/${p.id}`)}
              columns={[
                { key: 'passNo', label: 'Gate Pass No.', render: (p) => <span className="font-semibold text-slate-800">{p.passNo}</span> },
                { key: 'createdAt', label: 'Date / Time', render: (p) => fmtDateTime(p.createdAt), className: 'whitespace-nowrap' },
                { key: 'partyName', label: type === 'STORE' ? 'Movement' : 'Party' },
                { key: 'firstItem', label: 'Material', render: (p) => <span className="text-slate-600">{p.firstItem}{p.itemCount > 1 ? ` +${p.itemCount - 1}` : ''}</span> },
                ...(seeAll ? [{ key: 'requester', label: 'Requester', render: (p) => p.requester.name }] : []),
                ...(type !== 'STORE' ? [{ key: 'vehicleNo', label: 'Vehicle', render: (p) => p.vehicleNo || '—' }] : []),
                { key: 'totalValue', label: 'Value', render: (p) => inr(p.totalValue), className: 'text-right' },
                ...(type === 'RGP'
                  ? [{
                      key: 'expectedReturnDate',
                      label: 'Expected Return',
                      render: (p) => p.returnedAt ? <Badge tone="Approved">Returned</Badge> : p.gateStatus === 'Exited' && p.expectedReturnDate < new Date().toISOString().slice(0, 10) ? <Badge tone="Rejected">Overdue {p.expectedReturnDate}</Badge> : p.expectedReturnDate,
                    }]
                  : []),
                { key: 'status', label: 'Status', render: (p) => <div className="flex gap-1"><Badge>{p.status}</Badge>{p.isDirectEntry && <Badge tone="Direct">Direct</Badge>}</div> },
              ]}
            />
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
              <span>{data.data.length ? `Showing ${page * PAGE + 1}–${page * PAGE + data.data.length}` : ''}</span>
              <div className="flex gap-2">
                <Button size="sm" tone="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" tone="secondary" disabled={data.data.length < PAGE} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
