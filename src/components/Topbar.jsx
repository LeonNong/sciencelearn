import { useAuth } from '../lib/auth'

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth()

  return (
    <header className="h-14 flex items-center px-4 gap-4 flex-shrink-0"
      style={{ background: '#1a1a2e', borderBottom: '3px solid #3b82f6' }}>
      <button className="lg:hidden text-gray-400 hover:text-white p-1 text-lg" onClick={onMenuClick}>☰</button>
      <div className="flex-1" />
      {user && (
        <div className="flex items-center gap-4">
          <span style={{ fontSize: '9px', color: '#fbbf24', fontFamily: "'Press Start 2P', monospace" }}>
            🔥 {user.streak}
          </span>
          <div className="hidden sm:flex items-center gap-2"
            style={{ border: '2px solid #3b82f6', padding: '4px 10px', background: '#0f0f1a' }}>
            <span style={{ fontSize: '9px', color: '#60a5fa', fontFamily: "'Press Start 2P', monospace" }}>
              LV.{user.level}
            </span>
            <div style={{ width: 64, height: 8, background: '#374151', border: '1px solid #4b5563' }}>
              <div style={{ width: `${user.xp % 100}%`, height: '100%', background: '#3b82f6' }} />
            </div>
            <span style={{ fontSize: '8px', color: '#9ca3af', fontFamily: "'Press Start 2P', monospace" }}>
              {user.xp}XP
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
