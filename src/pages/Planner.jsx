import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Mathematical Literacy', 'English', 'Afrikaans', 'isiZulu', 'Life Orientation']

const SUBJECT_COLORS = {
  Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', Afrikaans: '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

function CalendarView({ plan, subject, examDate }) {
  if (!plan?.plan?.length) return null
  // Group days by week
  const weeks = []
  let week = []
  plan.plan.forEach((day, i) => {
    week.push(day)
    if (week.length === 7 || i === plan.plan.length - 1) { weeks.push([...week]); week = [] }
  })
  const color = SUBJECT_COLORS[subject] || '#3b82f6'

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white">📅 Calendar View</h3>
        <span className="text-xs text-gray-500">Exam: {examDate}</span>
      </div>
      <div className="space-y-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => (
              <div key={di} className="rounded-lg p-2 text-center text-xs"
                style={{ background: color + '20', borderLeft: `3px solid ${color}` }}>
                <div className="font-bold text-gray-700 dark:text-gray-300">Day {day.day}</div>
                <div className="text-gray-500 truncate mt-0.5" title={day.topic}>{day.topic?.split(' ').slice(0, 2).join(' ')}</div>
                <div className="text-gray-400 mt-0.5">{day.hours}h</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Exam day marker */}
      <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{ background: '#ef444420', border: '2px solid #ef4444' }}>
        <span>🎯</span>
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Exam Day: {examDate}</span>
      </div>
    </div>
  )
}

export default function Planner() {
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState({ subject: 'Biology', examDate: '', hoursPerDay: 2, weakTopics: '' })
  const [activePlan, setActivePlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'

  useEffect(() => { api.getPlans().then(setPlans).catch(() => {}) }, [])

  async function generate(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const plan = await api.generatePlan(form)
      setPlans(p => [{ exam_date: form.examDate, subject: form.subject, plan_json: plan, id: Date.now() }, ...p])
      setActivePlan({ exam_date: form.examDate, subject: form.subject, plan_json: plan })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const plan = activePlan?.plan_json || (plans[0]?.plan_json)
  const daysLeft = activePlan ? Math.ceil((new Date(activePlan.exam_date) - new Date()) / 86400000) : null

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">📅 Study Planner</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">Generate Study Plan</h2>
            <form onSubmit={generate} className="space-y-3">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Exam Date</label>
                <input type="date" className="input" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="label">Hours per day</label>
                <select className="input" value={form.hoursPerDay} onChange={e => setForm(f => ({ ...f, hoursPerDay: Number(e.target.value) }))}>
                  {[1,2,3,4,5].map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Weak Topics (optional)</label>
                <input className="input" value={form.weakTopics} onChange={e => setForm(f => ({ ...f, weakTopics: e.target.value }))} placeholder="e.g. Genetics, Acids" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? '✨ Generating...' : '✨ Generate Plan'}
              </button>
            </form>
          </div>

          {/* Saved plans */}
          {plans.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Saved Plans</h3>
              <div className="space-y-2">
                {plans.map(p => (
                  <button key={p.id} onClick={() => setActivePlan(p)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition
                      ${activePlan?.id === p.id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    📅 {p.subject} — {p.exam_date}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plan display */}
        <div className="lg:col-span-2">
          {plan ? (
            <>
              {daysLeft !== null && (
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-primary-700 dark:text-primary-300 font-semibold">
                      ⏰ {daysLeft} days until exam · {activePlan?.subject}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setViewMode('list')}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        📋 List
                      </button>
                      <button onClick={() => setViewMode('calendar')}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition ${viewMode === 'calendar' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        📅 Calendar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'calendar' ? (
                <CalendarView plan={plan} subject={activePlan?.subject} examDate={activePlan?.exam_date} />
              ) : (
                <>
                  {plan.tips && (
                    <div className="card mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">💡 Study Tips</h3>
                      <ul className="space-y-1">
                        {plan.tips.map((t, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex gap-2"><span className="text-primary-500">→</span>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-3">
                    {plan.plan?.map(day => (
                      <div key={day.day} className="card hover:shadow-md transition">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold">{day.day}</span>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">{day.topic}</div>
                            <div className="text-xs text-gray-400">{day.date} · {day.hours}h</div>
                          </div>
                        </div>
                        <ul className="space-y-1 ml-11">
                          {day.tasks?.map((task, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex gap-2">
                              <span className="text-green-500">✓</span>{task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="card h-64 flex items-center justify-center text-center text-gray-400">
              <div>
                <p className="text-4xl mb-3">📅</p>
                <p>Generate a study plan to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
