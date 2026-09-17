import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowLeftRight, BarChart3, Bell, CheckSquare, ClipboardList, Database, DoorOpen, FileBarChart, FileOutput, FileX, History,
  LayoutDashboard, LogOut, Menu, Scale, Search, ShieldCheck, UserCircle, Users, Zap, Undo2, UserSquare2,
} from 'lucide-react'
import { api, qs, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ROLE_LABELS } from '../constants.js'
import { fmtDateTime } from './ui.jsx'

const NAV = [
  { group: 'Main', items: [{ id: 'dashboard', to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Gate Passes',
    items: [
      { id: 'NRGP', to: '/passes/NRGP', label: 'NRGP', icon: FileOutput },
      { id: 'RGP', to: '/passes/RGP', label: 'RGP', icon: Undo2 },
      { id: 'SCRAP', to: '/passes/SCRAP', label: 'Scrap Outward', icon: FileX },
      { id: 'INWARD', to: '/passes/INWARD', label: 'Inward', icon: ArrowDownToLine },
      { id: 'STORE', to: '/passes/STORE', label: 'Store Movement', icon: ArrowLeftRight },
    ],
  },
  { group: 'Approvals', items: [{ id: 'approvals', to: '/approvals', label: 'Pending Approvals', icon: CheckSquare }] },
  {
    group: 'Security',
    items: [
      { id: 'gate', to: '/gate', label: 'Gate Entry / Exit', icon: DoorOpen },
      { id: 'visitors', to: '/visitors', label: 'Visitor Register', icon: UserSquare2 },
    ],
  },
  {
    group: 'Store',
    items: [
      { id: 'weighbridge', to: '/weighbridge', label: 'Weighbridge', icon: Scale },
      { id: 'direct', to: '/direct', label: 'Direct Gate Pass', icon: Zap },
      { id: 'masters', to: '/masters', label: 'Master Data', icon: Database },
      { id: 'reports', to: '/reports', label: 'Reports & Export', icon: FileBarChart },
    ],
  },
  {
    group: 'Super Admin',
    items: [
      { id: 'users', to: '/users', label: 'User Management', icon: Users },
      { id: 'roles', to: '/roles', label: 'Roles & Permissions', icon: ShieldCheck },
      { id: 'analytics', to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'audit', to: '/audit', label: 'Audit Log', icon: History },
    ],
  },
]

export default function Layout() {
  const { user, can, logout, toast } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')
  const notes = useApi('/notifications')

  // Refresh notifications on navigation and every minute.
  useEffect(() => {
    notes.reload()
    const t = setInterval(notes.reload, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const myNotes = notes.data?.data || []
  const unread = notes.data?.unread || 0

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    notes.reload()
  }

  const openNote = async (n) => {
    setBell(false)
    if (!n.isRead) api.post(`/notifications/${n.id}/read`).then(notes.reload)
    if (n.link) navigate(n.link)
  }

  const search = async (e) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    try {
      const { data } = await api.get(`/gate-passes${qs({ q: term, limit: 1, includeDeleted: 'true' })}`)
      if (data.length) {
        navigate(`/pass/${data[0].id}`)
        setQ('')
      } else toast(`No gate pass matches “${term}”`, 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy-900 text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-bold text-brand-700">M</div>
        <div className="leading-tight">
          <div className="font-bold tracking-wide text-white">MARS</div>
          <div className="text-[10px] tracking-wider text-slate-400 uppercase">Gate Pass System</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((sec) => {
          const items = sec.items.filter((i) => can(i.id))
          if (!items.length) return null
          return (
            <div key={sec.group}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{sec.group}</div>
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white'}`
                  }
                >
                  <Icon size={16} /> {label}
                </NavLink>
              ))}
            </div>
          )
        })}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Account</div>
          <NavLink to="/notifications" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <Bell size={16} /> Notifications
          </NavLink>
          <NavLink to="/profile" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <UserCircle size={16} /> My Profile
          </NavLink>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="relative h-full w-64" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <form onSubmit={search} className="relative hidden max-w-sm flex-1 sm:block">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search gate pass no. or vehicle no…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm focus:border-brand-500 focus:bg-white focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => { setBell(!bell); setMenu(false) }}>
                <Bell size={18} />
                {unread > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button className="text-xs text-brand-600 hover:underline" onClick={markAllRead}>Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {myNotes.length === 0 && <div className="p-6 text-center text-sm text-slate-400">You're all caught up</div>}
                    {myNotes.slice(0, 8).map((n) => (
                      <button key={n.id} onClick={() => openNote(n)} className={`block w-full border-b border-slate-50 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${n.isRead ? 'text-slate-500' : 'bg-brand-50/50 text-slate-800'}`}>
                        {n.message}
                        <div className="text-xs text-slate-400">{fmtDateTime(n.at)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100" onClick={() => { setMenu(!menu); setBell(false) }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
                </div>
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg" onClick={() => setMenu(false)}>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/profile')}>
                    <UserCircle size={15} /> My Profile
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50" onClick={() => { logout(); navigate('/login') }}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="no-print px-6 pb-4 text-xs text-slate-400">
          <ClipboardList size={12} className="mr-1 inline" /> MARS International India Pvt. Ltd. · Gate Pass Management System
        </footer>
      </div>
    </div>
  )
}
