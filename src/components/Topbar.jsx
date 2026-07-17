import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth()
  const { dark, toggle } = useTheme()

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4 flex-shrink-0">
      <button className="lg:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white p-1" onClick={onMenuClick}>
        ☰
      </button>
      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-sm">🔥 {user.streak} day streak</span>
          <div className="hidden sm:flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">Lv.{user.level}</span>
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${(user.xp % 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500">{user.xp} XP</span>
          </div>
        </div>
      )}

      <button onClick={toggle} className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
        {dark ? '☀️' : '🌙'}
      </button>
    </header>
  )
}
