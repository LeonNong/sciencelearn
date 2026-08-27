import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import Loader from '../components/Loader'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

const SUBJECT_COLORS = {
  Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', 'English HL': '#ec4899', Afrikaans: '#f97316',
  'Afrikaans FAL': '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa',
  'Information Technology': '#64748b', 'Physical Sciences': '#f59e0b', 'Life Sciences': '#10b981',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState([])

  useEffect(() => {
    api.dashboard().then(setData).catch(() => {}).finally(() => setLoading(false))
    api.getGrades().then(setGrades).catch(() => {})
  }, [])

  if (loading) return <Loader className="py-20" />

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { to: '/lare',       icon: '⚡', label: 'LARE',         color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
          { to: '/tutor',      icon: '🤖', label: 'Ask AI',        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
          { to: '/quiz',       icon: '🧪', label: 'Take Quiz',     color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
          { to: '/flashcards', icon: '🃏', label: 'Flashcards',    color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
          { to: '/planner',    icon: '📅', label: 'Planner',       color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
          { to: '/scanner',    icon: '📷', label: 'Scan HW',       color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' },
          { to: '/notes',      icon: '📓', label: 'Notes',         color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
          { to: '/grades',     icon: '📈', label: 'Grade Tracker', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
          { to: '/comments',   icon: '💬', label: 'Comments',      color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300' },
          { to: '/memory',     icon: '⌨️', label: 'Memory Typing', color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' },
          { to: '/chat',       icon: '🗨️', label: 'Chat',          color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' },
          { to: '/language',   icon: '🌐', label: 'Language',       color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' },
          { to: '/leaderboard',icon: '🏆', label: 'Leaderboard',    color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
        ].map(({ to, icon, label, color }) => (
          <Link key={to} to={to} className={`card flex flex-col items-center gap-2 py-4 hover:shadow-md transition cursor-pointer ${color}`}>
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Grade tracker line chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">📈 Grade Tracker</h2>
            <Link to="/grades" className="text-xs text-primary-400 hover:text-primary-300 transition">View all →</Link>
          </div>
          {grades.length > 0 ? (() => {
            const subjects = [...new Set(grades.map(g => g.subject))]
            const allDates = [...new Set(grades.map(g => g.date))].sort()
            return (
              <Line
                data={{
                  labels: allDates,
                  datasets: subjects.map(subj => {
                    const color = SUBJECT_COLORS[subj] || '#6b7280'
                    const sg = grades.filter(g => g.subject === subj)
                    return {
                      label: subj,
                      data: allDates.map(d => { const g = sg.find(g => g.date === d); return g ? g.score : null }),
                      borderColor: color,
                      backgroundColor: color + '20',
                      fill: false,
                      tension: 0.3,
                      pointRadius: 4,
                      spanGaps: true,
                    }
                  })
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` } } },
                  scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%', color: '#6b7280' }, grid: { color: '#1f2937' } }, x: { ticks: { color: '#6b7280' } } }
                }}
              />
            )
          })() : (
            <p className="text-gray-500 text-sm text-center py-8">No grades yet — <Link to="/grades" className="text-primary-400 hover:underline">add your first result</Link></p>
          )}
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

      {/* Update Log */}
      <div className="card">
        <h2 className="font-bold text-white mb-4">📋 Update Log</h2>
        <div className="space-y-3">
          {[
            { date: '2026-08-28', tag: 'NEW', color: '#10b981', items: ['Leaderboard — XP / Streak / Level ranking with podium and search'] },
            { date: '2026-08-28', tag: 'NEW', color: '#10b981', items: ['Dashboard — Update Log', 'Settings — Home Language preference, Description field (replaces Year/Grade)'] },
            { date: '2026-08-27', tag: 'NEW', color: '#10b981', items: [
              'Language Learning — Vocabulary flashcards (flip, multi-meaning, pos abbr, Afrikaans v1/v2/tense, AI refresh all)',
              'Writing — AI detects AI-generated content, highlights native language words, one-click add to vocab',
              'Review — 百词斩 style multiple choice with streak counter',
              'Adaptive Quiz, Grammar Practice, Progress stats',
            ]},
            { date: '2026-08-27', tag: 'FIX', color: '#3b82f6', items: ['Grade Tracker — bulk year setter in AI scan modal', 'Year filter with All Years default'] },
            { date: '2026-08-26', tag: 'NEW', color: '#10b981', items: [
              'Grade Tracker — import from ADAM HTML file, PDF scan support',
              'Grade Tracker — collapsible subject groups, clear all, teacher comments',
              'Grade Tracker — line chart on Dashboard',
              'Comments page — scan report card for teacher remarks',
              'Register — confirm password field',
            ]},
            { date: '2026-08-25', tag: 'NEW', color: '#10b981', items: ['Notes page — create, edit, pin, search, auto-save'] },
            { date: '2026-08-25', tag: 'FIX', color: '#3b82f6', items: ['Flashcard badge colors and quiz text contrast for dark theme', 'AI structured responses, calendar view in Planner'] },
            { date: '2026-08-24', tag: 'NEW', color: '#10b981', items: [
              'Settings page — display name, school, grade, avatar color',
              'Pixel art UI — font, borders, colors, sidebar, pixel frog logo',
              'Memory Typing game — 3 difficulty levels',
              'Floating feedback button',
              'LARE engine — adaptive learning priority ranking',
            ]},
            { date: '2026-08-23', tag: 'NEW', color: '#10b981', items: [
              'AI rate limiting with daily usage display',
              'Switched AI from Gemini to OpenAI GPT-4o',
              'Chat rooms — delete room for owner/admin',
              'Lazy loading + Render keep-alive ping',
            ]},
            { date: '2026-08-22', tag: 'NEW', color: '#10b981', items: ['Initial launch — AI Tutor, Quiz, Flashcards, Study Planner, OCR Scanner, Chat Rooms'] },
          ].map((entry, i) => (
            <div key={i} className="flex gap-3 text-xs">
              <div className="flex-shrink-0 w-20 text-gray-600">{entry.date}</div>
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-bold h-fit" style={{ background: entry.color + '20', color: entry.color, border: `1px solid ${entry.color}40` }}>
                {entry.tag}
              </span>
              <ul className="space-y-1">
                {entry.items.map((item, j) => (
                  <li key={j} className="text-gray-400">— {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
