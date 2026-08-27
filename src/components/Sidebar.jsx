import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const nav = [
  { to: '/',          icon: '📊', label: 'Dashboard' },
  { to: '/lare',      icon: '⚡', label: 'LARE' },
  { to: '/tutor',     icon: '🤖', label: 'AI Tutor' },
  { to: '/quiz',      icon: '🧪', label: 'Quiz' },
  { to: '/flashcards',icon: '🃏', label: 'Flashcards' },
  { to: '/planner',   icon: '📅', label: 'Study Planner' },
  { to: '/scanner',   icon: '📷', label: 'OCR Scanner' },
  { to: '/memory',    icon: '⌨️', label: 'Memory Typing' },
  { to: '/notes',     icon: '📓', label: 'Notes' },
  { to: '/grades',    icon: '📈', label: 'Grade Tracker' },
  { to: '/comments',  icon: '💬', label: 'Comments' },
  { to: '/language',    icon: '🌐', label: 'Language' },
  { to: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { to: '/settings',  icon: '⚙️', label: 'Settings' },
  { to: '/chat',      icon: '💬', label: 'Chat Rooms' },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  return (
    <aside className={`
      fixed lg:static z-30 h-full w-64 flex flex-col transition-transform duration-200
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `} style={{ background: '#1a1a2e', borderRight: '3px solid #3b82f6' }}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5" style={{ borderBottom: '3px solid #3b82f6' }}>
        <span className="text-2xl">
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
        </span>
        <div>
          <div className="font-bold text-white text-xs" style={{ fontFamily: "'Press Start 2P', monospace", textShadow: '2px 2px 0 #1d4ed8' }}>LearnWay</div>
          <div className="text-xs mt-1" style={{ color: '#60a5fa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>ADAPTIVE AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-xs font-medium transition cursor-pointer
              ${isActive
                ? 'text-white'
                : 'text-gray-400 hover:text-white'}`
            }
            style={({ isActive }) => isActive ? {
              background: '#0f0f1a',
              borderLeft: '4px solid #3b82f6',
              boxShadow: 'inset 0 0 0 1px #3b82f620',
            } : {}}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User panel */}
      {user && (
        <div className="p-3" style={{ borderTop: '3px solid #3b82f6' }}>
          <div className="flex items-center gap-3 p-2">
            <div className="w-9 h-9 flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: user.avatarColor, border: '2px solid #fff', imageRendering: 'pixelated' }}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white truncate" style={{ fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>{user.username}</div>
              <div className="mt-1" style={{ fontSize: '8px', color: '#60a5fa' }}>LV.{user.level} · {user.xp}XP</div>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-500 transition text-sm" title="Logout">⏏</button>
          </div>
        </div>
      )}
    </aside>
  )
}
