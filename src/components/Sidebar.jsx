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
  { to: '/chat',      icon: '💬', label: 'Chat Rooms' },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  return (
    <aside className={`
      fixed lg:static z-30 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
      flex flex-col transition-transform duration-200
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-200 dark:border-gray-700">
        <span className="text-2xl">⚡</span>
        <div>
          <div className="font-bold text-gray-900 dark:text-white text-sm">LearnWay</div>
          <div className="text-xs text-primary-500 font-medium">Adaptive · AI Powered</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
              ${isActive
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User panel */}
      {user && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: user.avatarColor }}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.username}</div>
              <div className="text-xs text-gray-500">Lv.{user.level} · {user.xp} XP</div>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-500 transition text-sm" title="Logout">⏏</button>
          </div>
        </div>
      )}
    </aside>
  )
}
