import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Card, Loading } from './components/ui.jsx'
import Analytics from './pages/Analytics.jsx'
import Approvals from './pages/Approvals.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Direct from './pages/Direct.jsx'
import Gate from './pages/Gate.jsx'
import Login, { ResetPassword } from './pages/Login.jsx'
import Masters from './pages/Masters.jsx'
import { Audit, Notifications, Profile } from './pages/Misc.jsx'
import PassDetail from './pages/PassDetail.jsx'
import PassForm from './pages/PassForm.jsx'
import PassList from './pages/PassList.jsx'
import Reports from './pages/Reports.jsx'
import Roles from './pages/Roles.jsx'
import Users from './pages/Users.jsx'
import VisitorApply from './pages/VisitorApply.jsx'
import Visitors from './pages/Visitors.jsx'
import Weighbridge from './pages/Weighbridge.jsx'

function Guard({ screen, children }) {
  const { can } = useAuth()
  if (screen && !can(screen))
    return (
      <Card>
        <div className="py-10 text-center">
          <div className="text-lg font-semibold text-slate-800">Access restricted</div>
          <p className="mt-1 text-sm text-slate-500">Your role does not have permission for this screen. A Super Admin can grant it under Roles & Permissions.</p>
        </div>
      </Card>
    )
  return children
}

function RequireAuth() {
  const { user, booting } = useAuth()
  const location = useLocation()
  if (booting) return <Loading label="Signing you in…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout />
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/visitor-pass" element={<VisitorApply />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Dashboard />} />
        <Route path="passes/:type" element={<PassList />} />
        <Route path="passes/:type/new" element={<PassForm />} />
        <Route path="passes/:type/:id/edit" element={<PassForm />} />
        <Route path="pass/:id" element={<PassDetail />} />
        <Route path="approvals" element={<Guard screen="approvals"><Approvals /></Guard>} />
        <Route path="gate" element={<Guard screen="gate"><Gate /></Guard>} />
        <Route path="visitors" element={<Guard screen="visitors"><Visitors /></Guard>} />
        <Route path="weighbridge" element={<Guard screen="weighbridge"><Weighbridge /></Guard>} />
        <Route path="direct" element={<Guard screen="direct"><Direct /></Guard>} />
        <Route path="masters" element={<Guard screen="masters"><Masters /></Guard>} />
        <Route path="reports" element={<Guard screen="reports"><Reports /></Guard>} />
        <Route path="audit" element={<Guard screen="audit"><Audit /></Guard>} />
        <Route path="users" element={<Guard screen="users"><Users /></Guard>} />
        <Route path="roles" element={<Guard screen="roles"><Roles /></Guard>} />
        <Route path="analytics" element={<Guard screen="analytics"><Analytics /></Guard>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
