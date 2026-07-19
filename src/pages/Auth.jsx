import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Auth() {
  const { login } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = isLogin
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form)
      login(res.user, res.token)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-science-chem flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div class="text-5xl mb-3">⚡</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">LearnWay</h1>
          <p className="text-gray-500 text-sm mt-1">Adaptive AI-powered revision platform</p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
          {['Log In', 'Register'].map((t, i) => (
            <button key={t} onClick={() => { setIsLogin(i === 0); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition
                ${(isLogin ? i === 0 : i === 1) ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="Your username" required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 text-center">
          ⚡ Powered by LARE — LearnWay Adaptive Revision Engine
        </div>
      </div>
    </div>
  )
}
