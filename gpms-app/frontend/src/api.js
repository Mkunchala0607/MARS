import { useCallback, useEffect, useRef, useState } from 'react'

const BASE = '/api/v1'
const TOKEN_KEY = 'gpms-token'

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(t) {
    try {
      t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage blocked — session lasts until reload */
    }
  },
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`)
    this.status = status
    this.fields = body?.fields || {}
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn)

async function request(method, path, body, { raw = false } = {}) {
  const headers = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) })
  if (raw && res.ok) return res
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError(res.status, data)
  }
  return data
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p, b) => request('DELETE', p, b),
  upload: (p, formData) => request('POST', p, formData),
  /** Download a file (report export / attachment) with auth and trigger a browser save. */
  async download(p, fallbackName) {
    const res = await request('GET', p, undefined, { raw: true })
    const cd = res.headers.get('Content-Disposition') || ''
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

export const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return s.toString() ? `?${s}` : ''
}

/** Load data from the API; re-runs when `key` changes. Returns { data, error, loading, reload, setData }. */
export function useApi(path, key = path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const seq = useRef(0)
  const load = useCallback(async () => {
    if (!path) return
    const n = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await api.get(path)
      if (n === seq.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (n === seq.current) setState({ data: null, error, loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    load()
  }, [load])
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) }
}
