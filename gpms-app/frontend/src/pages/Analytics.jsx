import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { qs, useApi } from '../api.js'
import { PASS_TYPES, daysAgo, today } from '../constants.js'
import { Card, ErrorState, Field, Input, Loading, PageHeader, Stat, inr } from '../components/ui.jsx'

const STATUS_COLORS = { Pending: '#f59e0b', Approved: '#10b981', Rejected: '#f43f5e' }
const axis = { tick: { fontSize: 12, fill: '#64748b' }, axisLine: false, tickLine: false }

export default function Analytics() {
  const [range, setRange] = useState({ from: daysAgo(30), to: today() })
  const { data, error, reload } = useApi(`/dashboard/analytics${qs(range)}`)

  const header = (
    <>
      <PageHeader crumbs={['Admin', 'Analytics']} title="Analytics Dashboard" subtitle="Volume trends and approval turnaround across the plant." />
      <Card className="mb-6">
        <div className="grid gap-4 sm:w-96 sm:grid-cols-2">
          <Field label="From"><Input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        </div>
      </Card>
    </>
  )
  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>
  if (!data) return <>{header}<Loading /></>

  const t = data.totals
  const decided = t.approved + t.rejected
  const byType = data.byType.map((r) => ({ ...r, name: PASS_TYPES[r.type].short }))
  const byStatus = ['Pending', 'Approved', 'Rejected'].map((s) => ({ name: s, value: byType.reduce((sum, r) => sum + r[s], 0) }))

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gate passes" value={t.passes} />
        <Stat label="Avg. approval turnaround" value={t.avgTurnaroundHours == null ? '—' : `${t.avgTurnaroundHours.toFixed(1)} h`} sub="Submitted → decision" tone="text-brand-600" />
        <Stat label="Approval rate" value={decided ? `${Math.round((t.approved / decided) * 100)}%` : '—'} tone="text-emerald-600" />
        <Stat label="Visitors" value={t.visitors} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Requests by type & status" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" {...axis} />
                <YAxis allowDecimals={false} width={28} {...axis} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(STATUS_COLORS).map(([k, c]) => <Bar key={k} dataKey={k} stackId="a" fill={c} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Status split">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byStatus.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Daily request volume" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.daily.map((d) => ({ day: d.day.slice(5), Requests: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" {...axis} />
                <YAxis allowDecimals={false} width={28} {...axis} />
                <Tooltip />
                <Line type="monotone" dataKey="Requests" stroke="#4b45e0" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Top parties by value" pad={false}>
          {data.topParties.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No data</div>}
          {data.topParties.map((p) => (
            <div key={p.name} className="flex justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm last:border-0">
              <span className="truncate">{p.name} <span className="text-xs text-slate-400">({p.n})</span></span>
              <span className="font-semibold">{inr(p.value)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
