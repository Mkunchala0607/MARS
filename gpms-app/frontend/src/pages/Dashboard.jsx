import { useNavigate } from 'react-router-dom'
import { AlarmClock, ArrowDownToLine, ArrowLeftRight, CheckSquare, DoorOpen, FileOutput, FileX, Plus, QrCode, Scale, Truck, Undo2, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Badge, Button, Card, ErrorState, Loading, PageHeader, Stat, fmtDate } from '../components/ui.jsx'

const QUICK = [
  { type: 'NRGP', label: 'New NRGP', icon: FileOutput },
  { type: 'RGP', label: 'New RGP', icon: Undo2 },
  { type: 'SCRAP', label: 'Scrap Outward', icon: FileX },
  { type: 'INWARD', label: 'Inward', icon: ArrowDownToLine },
  { type: 'STORE', label: 'Store Movement', icon: ArrowLeftRight },
]

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function RecentList({ rows, empty }) {
  const navigate = useNavigate()
  if (!rows.length) return <div className="p-8 text-center text-sm text-slate-400">{empty}</div>
  return rows.map((p) => (
    <button key={p.id} onClick={() => navigate(`/pass/${p.id}`)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-left last:border-0 hover:bg-slate-50">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800">{p.passNo} {p.isDirectEntry && <Badge tone="Direct">Direct Entry</Badge>}</div>
        <div className="truncate text-xs text-slate-500">{[p.requester.name, p.partyName, p.firstItem, fmtDate(p.createdAt)].filter(Boolean).join(' · ')}</div>
      </div>
      <Badge>{p.status}</Badge>
    </button>
  ))
}

export default function Dashboard() {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const dash = useApi('/dashboard')
  const recent = useApi('/gate-passes?limit=6')

  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />
  if (!dash.data) return <Loading />
  const first = user.name.split(' ')[0]

  if (dash.data.kind === 'personal') {
    const c = dash.data.counts
    return (
      <>
        <PageHeader
          crumbs={['Dashboard']}
          title={`${greeting()}, ${first} 👋`}
          subtitle="Here's the status of your requests."
          actions={QUICK.some((q) => can(q.type)) && <Button icon={Plus} to={`/passes/${can('NRGP') ? 'NRGP' : 'INWARD'}/new`}>New Gate Pass</Button>}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="My Requests" value={c.total} />
          <Stat label="Pending" value={c.Pending} tone="text-amber-600" />
          <Stat label="Approved" value={c.Approved} tone="text-emerald-600" />
          <Stat label="Rejected" value={c.Rejected} tone="text-rose-600" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <Card title="Quick Actions" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              {QUICK.filter((q) => can(q.type)).map(({ type, label, icon: Icon }) => (
                <button key={type} onClick={() => navigate(`/passes/${type}/new`)} className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50/40">
                  <Icon size={20} className="text-brand-600" /> {label}
                </button>
              ))}
            </div>
          </Card>
          <Card title="My Recent Requests" className="lg:col-span-3" pad={false}>
            {recent.data ? <RecentList rows={recent.data.data.slice(0, 5)} empty="No requests yet — use Quick Actions to raise one." /> : <Loading />}
          </Card>
        </div>
      </>
    )
  }

  const s = dash.data.stats
  const chart = dash.data.activity.map((a) => ({ day: new Date(a.day).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' }), Inward: a.inward, Outward: a.outward }))
  const actions = [
    can('approvals') && { label: `Review approvals (${s.pendingApprovals})`, icon: CheckSquare, to: '/approvals' },
    can('gate') && { label: 'Scan / verify pass', icon: QrCode, to: '/gate' },
    can('weighbridge') && { label: 'Weighbridge entry', icon: Scale, to: '/weighbridge' },
    can('visitors') && { label: 'Visitor register', icon: Users, to: '/visitors' },
    can('direct') && { label: 'Direct gate pass', icon: DoorOpen, to: '/direct' },
  ].filter(Boolean)

  return (
    <>
      <PageHeader crumbs={['Dashboard']} title={`${greeting()}, ${first} 👋`} subtitle="Plant-wide gate activity." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gate Passes Today" value={s.passesToday} icon={FileOutput} />
        <Stat label="Pending Approvals" value={s.pendingApprovals} tone="text-amber-600" icon={CheckSquare} sub={`${s.pendingPasses} passes · ${s.pendingVisitors} visitors · ${s.pendingWeighments} weighments`} />
        <Stat label="Visitors Today" value={s.visitorsToday} icon={Users} sub={`${s.visitorsInside} currently inside`} />
        <Stat label="Approved, Awaiting Gate" value={s.awaitingGate} icon={Truck} sub={s.rgpOverdue ? `${s.rgpOverdue} RGP overdue for return` : 'No overdue RGP returns'} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Gate Pass Activity — last 7 days" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Inward" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Outward" fill="#4b45e0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="space-y-6">
          {s.rgpOverdue > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlarmClock size={20} /> {s.rgpOverdue} returnable item(s) are past their expected return date.
            </div>
          )}
          <Card title="Quick Actions">
            <div className="grid gap-2">
              {actions.map(({ label, icon: Icon, to }) => (
                <Button key={to} tone="secondary" icon={Icon} className="justify-start" onClick={() => navigate(to)}>{label}</Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <Card title="Latest Gate Passes" className="mt-6" pad={false}>
        {recent.data ? <RecentList rows={recent.data.data} empty="No gate passes yet" /> : <Loading />}
      </Card>
    </>
  )
}
