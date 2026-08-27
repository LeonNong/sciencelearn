import { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('sl_token')
    if (!token) { setLoading(false); return }

    // Optimistic: show cached user immediately while we verify
    const stored = localStorage.getItem('sl_user')
    if (stored) setUser(JSON.parse(stored))

    api.me()
      .then(userData => {
        setUser(userData)
        localStorage.setItem('sl_user', JSON.stringify(userData))
      })
      .catch(() => {
        localStorage.removeItem('sl_token')
        localStorage.removeItem('sl_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  function login(userData, token) {
    localStorage.setItem('sl_token', token)
    localStorage.setItem('sl_user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('sl_token')
    localStorage.removeItem('sl_user')
    setUser(null)
  }

  function updateUser(updates) {
    const updated = { ...user, ...updates }
    localStorage.setItem('sl_user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
