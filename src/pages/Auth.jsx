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
    <div className="min-h-screen flex" style={{ background: '#0f0f1a' }}>
      {/* Left decorative panel - hidden on mobile */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1 p-12"
        style={{ borderRight: '3px solid #3b82f6', background: '#1a1a2e' }}>
        <div style={{ marginBottom: 24, imageRendering: 'pixelated' }}>
          <img src="/logo.png" alt="LearnWay" style={{ width: 96, height: 96, imageRendering: 'pixelated' }} />
        </div>
        <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: '#3b82f6', textShadow: '4px 4px 0 #1d4ed8', marginBottom: 16 }}>
          LearnWay
        </h2>
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#60a5fa', textAlign: 'center', lineHeight: 2.2, maxWidth: 320 }}>
          ADAPTIVE REVISION ENGINE
        </p>
        {/* Pixel decoration */}
        <div className="mt-12 grid grid-cols-4 gap-3">
          {['📊','⚡','🧪','🃏','📅','📷','💬','⌨️'].map((icon, i) => (
            <div key={i} className="flex items-center justify-center text-2xl"
              style={{ width: 52, height: 52, border: '2px solid #3b82f620', background: '#0f0f1a' }}>
              {icon}
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#4b5563', marginTop: 40 }}>
          LARE · ADAPTIVE AI · REVISION
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center flex-1 p-6 lg:p-16">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <img src="/logo.png" alt="LearnWay" style={{ width: 64, height: 64, imageRendering: 'pixelated', margin: '0 auto' }} />
          <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 16, color: '#3b82f6', textShadow: '3px 3px 0 #1d4ed8', marginTop: 12 }}>
            LearnWay
          </h1>
        </div>

        <div className="w-full" style={{ maxWidth: 420 }}>
          {/* Tab switcher */}
          <div className="flex mb-8" style={{ border: '2px solid #3b82f6' }}>
            {['Log In', 'Register'].map((t, i) => (
              <button key={t} onClick={() => { setIsLogin(i === 0); setError('') }}
                className="flex-1 py-3 font-semibold transition"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 10,
                  background: (isLogin ? i === 0 : i === 1) ? '#3b82f6' : '#0f0f1a',
                  color: (isLogin ? i === 0 : i === 1) ? '#fff' : '#6b7280',
                  borderRight: i === 0 ? '2px solid #3b82f6' : 'none',
                }}>
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
            {error && (
              <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#ef4444', background: '#1a0a0a', border: '2px solid #ef4444', padding: '8px 12px' }}>
                ❌ {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? '...' : isLogin ? '▶ Log In' : '▶ Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#374151', borderTop: '2px solid #1f2937', paddingTop: 16 }}>
            ⚡ POWERED BY LARE ENGINE
          </div>
        </div>
      </div>
    </div>
  )
}
