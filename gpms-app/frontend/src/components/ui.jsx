import { Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TIMELINE_LABELS } from '../constants.js'

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

export function PageHeader({ crumbs = [], title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1 text-xs text-slate-400">{['GPMS', ...crumbs].join(' › ')}</div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '', pad = true }) {
  return (
    <div className={`print-area rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </div>
  )
}

const btnTones = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

export function Button({ tone = 'primary', icon: Icon, children, className = '', to, size = 'md', ...props }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed ${
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  } ${btnTones[tone]} ${className}`
  const inner = (
    <>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </>
  )
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  return (
    <button className={cls} {...props}>
      {inner}
    </button>
  )
}

const badgeTones = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  Deleted: 'bg-slate-100 text-slate-500 ring-slate-200',
  Direct: 'bg-violet-50 text-violet-700 ring-violet-200',
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inactive: 'bg-slate-100 text-slate-500 ring-slate-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function Badge({ children, tone }) {
  const t = badgeTones[tone || children] || badgeTones.neutral
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${t}`}>{children}</span>
}

export function Field({ label, required, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none read-only:bg-slate-50 read-only:text-slate-500 disabled:bg-slate-50'

export const Input = ({ className = '', ...props }) => <input className={`${inputCls} ${className}`} {...props} />
export const Textarea = ({ className = '', ...props }) => <textarea className={`${inputCls} ${className}`} rows={3} {...props} />
export function Select({ options, placeholder, className = '', ...props }) {
  return (
    <select className={`${inputCls} ${className}`} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  )
}

export function Stat({ label, value, tone = 'text-slate-900', icon: Icon, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        {label}
        {Icon && <Icon size={16} className="text-slate-400" />}
      </div>
      <div className={`mt-2 text-3xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export function Table({ columns, rows, empty = 'No records found', onRowClick, rowKey = 'id' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 uppercase">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.className || ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r[rowKey]}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-slate-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] w-full overflow-auto rounded-xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
            value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Timeline({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((t, i) => {
        const bad = ['Rejected', 'Deleted', 'SealMismatch'].includes(t.event)
        const good = ['Approved', 'GateExited', 'GateEntered', 'GateReturned', 'DirectEntry', 'CheckedIn'].includes(t.event)
        return (
          <li key={i} className="flex gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${bad ? 'bg-rose-500' : good ? 'bg-emerald-500' : 'bg-brand-500'}`} />
            <div className="text-sm">
              <div className="font-medium text-slate-800">
                {TIMELINE_LABELS[t.event] || t.event} <span className="font-normal text-slate-500">by {t.actor}</span>
              </div>
              <div className="text-xs text-slate-400">{fmtDateTime(t.at)}</div>
              {t.remarks && <div className="mt-0.5 text-xs text-slate-600 italic">“{t.remarks}”</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <Card>
      <div className="py-8 text-center">
        <div className="font-semibold text-slate-800">{error?.status === 404 ? 'Not found' : error?.status === 403 ? 'Access restricted' : 'Could not load data'}</div>
        <p className="mt-1 text-sm text-slate-500">{error?.message}</p>
        {onRetry && error?.status !== 404 && error?.status !== 403 && (
          <Button tone="secondary" className="mt-4" onClick={onRetry}>Try again</Button>
        )}
      </div>
    </Card>
  )
}
