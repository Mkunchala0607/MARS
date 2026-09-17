import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!tokenStore.get())
  const [toasts, setToasts] = useState([])

  const toast = useCallback((text, tone = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      toast('Your session has ended. Please sign in again.', 'info')
    })
    if (!tokenStore.get()) return
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setBooting(false))
  }, [logout, toast])

  const login = async (email, password, remember) => {
    const { token, user } = await api.post('/auth/login', { email, password, remember })
    tokenStore.set(token)
    setUser(user)
    return user
  }

  const refreshUser = async () => setUser(await api.get('/auth/me'))
  const can = (screen) => !!user?.permissions.includes(screen)

  /** Show an API error as a toast; returns field errors for inline display. */
  const fail = (err) => {
    toast(err.message || 'Something went wrong', 'error')
    return err.fields || {}
  }

  return (
    <AuthContext.Provider value={{ user, booting, login, logout, refreshUser, can, toast, fail }}>
      {children}
      <div className="no-print fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'error' ? 'bg-rose-600' : t.tone === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
