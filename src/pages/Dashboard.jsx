import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const SUBJECT_COLORS = { Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b' }

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20 text-4xl animate-spin">🔬</div>

  const quizBySubject = {}
  data?.quizzes?.forEach(q => {
    if (!quizBySubject[q.subject]) quizBySubject[q.subject] = { scores: [], total: 0 }
    quizBySubject[q.subject].scores.push((q.score / q.total) * 100)
    quizBySubject[q.subject].total++
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {user?.username}! 👋</h1>
        <p className="text-primary-100 mt-1">LARE has analysed your topics — ready to study smarter?</p>
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { icon: '⭐', label: 'XP', val: user?.xp || 0 },
            { icon: '🏆', label: 'Level', val: user?.level || 1 },
            { icon: '🔥', label: 'Day Streak', val: user?.streak || 0 },
            { icon: '🃏', label: 'Flashcards', val: data?.flashcardCount || 0 },
            { icon: '📋', label: 'Due Reviews', val: data?.dueCards || 0 },
          ].map(s => (
            <div key={s.label} className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="text-xl">{s.icon}</div>
              <div className="text-lg font-bold">{s.val}</div>
              <div className="text-xs text-primary-100">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/lare',       icon: '⚡', label: 'LARE', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
          { to: '/tutor',      icon: '🤖', label: 'Ask AI', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
          { to: '/quiz',       icon: '🧪', label: 'Take Quiz', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
          { to: '/flashcards', icon: '🃏', label: 'Flashcards', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
          { to: '/planner',    icon: '📅', label: 'Planner', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
          { to: '/scanner',    icon: '📷', label: 'Scan HW', color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' },
          { to: '/chat',       icon: '💬', label: 'Chat', color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' },
        ].map(({ to, icon, label, color }) => (
          <Link key={to} to={to} className={`card flex flex-col items-center gap-2 py-4 hover:shadow-md transition cursor-pointer ${color}`}>
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quiz history chart */}
        <div className="card">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Recent Quiz Scores</h2>
          {data?.quizzes?.length > 0 ? (
            <Bar
              data={{
                labels: data.quizzes.slice(0, 7).map((q, i) => `#${i + 1} ${q.subject}`),
                datasets: [{
                  label: 'Score %',
                  data: data.quizzes.slice(0, 7).map(q => Math.round((q.score / q.total) * 100)),
                  backgroundColor: data.quizzes.slice(0, 7).map(q => SUBJECT_COLORS[q.subject] || '#3b82f6'),
                  borderRadius: 6,
                }]
              }}
              options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100, beginAtZero: true } } }}
            />
          ) : <p className="text-gray-400 text-sm text-center py-8">No quizzes yet — take your first quiz!</p>}
        </div>

        {/* Study time chart */}
        <div className="card">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Study Time by Subject</h2>
          {data?.sessions?.length > 0 ? (
            <Doughnut
              data={{
                labels: data.sessions.map(s => s.subject),
                datasets: [{
                  data: data.sessions.map(s => s.total),
                  backgroundColor: data.sessions.map(s => SUBJECT_COLORS[s.subject] || '#3b82f6'),
                }]
              }}
              options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
            />
          ) : <p className="text-gray-400 text-sm text-center py-8">No study sessions logged yet.</p>}
        </div>
      </div>

      {/* Badges */}
      {data?.badges?.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">🏅 Badges Earned</h2>
          <div className="flex flex-wrap gap-3">
            {data.badges.map(b => (
              <div key={b.key} className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-3 py-2">
                <span className="text-xl">{b.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">{b.name}</div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
