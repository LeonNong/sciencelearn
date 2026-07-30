import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { Line } from 'react-chartjs-2'
import {
  Chart, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Mathematical Literacy',
  'English', 'English HL', 'Afrikaans', 'Afrikaans FAL', 'isiZulu', 'Life Orientation']

const SUBJECT_COLORS = {
  Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', 'English HL': '#ec4899', Afrikaans: '#f97316',
  'Afrikaans FAL': '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

function gradeSymbol(score) {
  if (score >= 80) return { label: 'Distinction', color: '#10b981', emoji: '🏆' }
  if (score >= 70) return { label: 'Merit', color: '#3b82f6', emoji: '🎉' }
  if (score >= 60) return { label: 'Adequate', color: '#f59e0b', emoji: '👍' }
  if (score >= 50) return { label: 'Moderate', color: '#f97316', emoji: '📚' }
  return { label: 'Below Pass', color: '#ef4444', emoji: '💪' }
}

// Scan modal — shows extracted grades for confirmation before saving
function ScanModal({ extracted, onConfirm, onClose }) {
  const [items, setItems] = useState(extracted)

  function update(i, field, val) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: field === 'score' ? Number(val) : val } : it))
  }
  function remove(i) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">📋 AI Extracted Grades</h2>
          <p className="text-sm text-gray-500 mt-1">Review and edit before saving. Remove any incorrect entries.</p>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center text-sm">
              <select className="input py-1 text-xs" value={item.subject}
                onChange={e => update(i, 'subject', e.target.value)}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
              <input className="input py-1 text-xs" value={item.label}
                onChange={e => update(i, 'label', e.target.value)} placeholder="Test name" />
              <input className="input py-1 text-xs w-16" type="number" min="0" max="100" value={item.score}
                onChange={e => update(i, 'score', e.target.value)} />
              <input className="input py-1 text-xs w-28" type="date" value={item.date}
                onChange={e => update(i, 'date', e.target.value)} />
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-gray-400 py-6">No entries left.</p>}
        </div>
        <div className="p-5 border-t dark:border-gray-700 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2">Cancel</button>
          <button onClick={() => onConfirm(items)} disabled={items.length === 0}
            className="btn-primary px-4 py-2">
            Save {items.length} result{items.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Grades() {
  const [grades, setGrades] = useState([])
  const [form, setForm] = useState({ subject: 'Biology', label: '', score: '', date: new Date().toISOString().split('T')[0] })
  const [activeSubject, setActiveSubject] = useState('All')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanPreview, setScanPreview] = useState(null)
  const [scanModal, setScanModal] = useState(null) // extracted grades
  const fileRef = useRef()

  useEffect(() => { api.getGrades().then(setGrades).catch(() => {}) }, [])

  const subjects = [...new Set(grades.map(g => g.subject))]

  async function addGrade(e) {
    e.preventDefault()
    if (!form.label.trim() || !form.score) return setError('All fields required')
    setError(''); setLoading(true)
    try {
      const g = await api.addGrade({ ...form, score: Number(form.score) })
      setGrades(prev => [...prev, g].sort((a, b) => a.date.localeCompare(b.date)))
      setForm(f => ({ ...f, label: '', score: '' }))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function deleteGrade(id) {
    await api.deleteGrade(id)
    setGrades(prev => prev.filter(g => g.id !== id))
  }

  // Handle image file picked or captured
  async function handleImageFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      setScanPreview(dataUrl)
      setScanning(true)
      setError('')
      try {
        // Strip "data:image/jpeg;base64," prefix
        const base64 = dataUrl.split(',')[1]
        const mimeType = file.type || 'image/jpeg'
        const result = await api.scanGrades(base64, mimeType)
        setScanModal(result.grades)
      } catch (err) {
        setError('AI scan failed: ' + err.message)
        setScanPreview(null)
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Save confirmed grades from scan modal
  async function handleScanConfirm(items) {
    setScanModal(null)
    setScanPreview(null)
    setLoading(true)
    try {
      const saved = await Promise.all(items.map(item => api.addGrade(item)))
      setGrades(prev => [...prev, ...saved].sort((a, b) => a.date.localeCompare(b.date)))
    } catch (err) { setError('Failed to save some grades: ' + err.message) }
    finally { setLoading(false) }
  }

  // Build chart data
  const filteredSubjects = activeSubject === 'All' ? subjects : [activeSubject]
  const allDates = [...new Set(grades.map(g => g.date))].sort()

  const chartData = {
    labels: allDates,
    datasets: filteredSubjects.map(subj => {
      const color = SUBJECT_COLORS[subj] || '#6b7280'
      const subjGrades = grades.filter(g => g.subject === subj)
      return {
        label: subj,
        data: allDates.map(d => {
          const g = subjGrades.find(g => g.date === d)
          return g ? g.score : null
        }),
        borderColor: color,
        backgroundColor: color + '20',
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        spanGaps: true,
      }
    })
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.raw}% (${gradeSymbol(ctx.raw).label})`
        }
      }
    },
    scales: {
      y: {
        min: 0, max: 100,
        ticks: { callback: v => v + '%', stepSize: 10 },
        grid: { color: '#e5e7eb' }
      }
    }
  }

  const stats = subjects.map(subj => {
    const sg = grades.filter(g => g.subject === subj)
    const avg = sg.length ? Math.round(sg.reduce((a, b) => a + b.score, 0) / sg.length) : 0
    const latest = sg[sg.length - 1]
    const prev = sg[sg.length - 2]
    const trend = latest && prev ? latest.score - prev.score : null
    return { subj, avg, latest, trend, count: sg.length }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {scanModal && (
        <ScanModal
          extracted={scanModal}
          onConfirm={handleScanConfirm}
          onClose={() => { setScanModal(null); setScanPreview(null) }}
        />
      )}

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📈 Grade Tracker</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Add grade form */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-900 dark:text-white">Add Exam Result</h2>

          {/* AI Scan button */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => handleImageFile(e.target.files[0])} />
            <button
              onClick={() => fileRef.current.click()}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-primary-400 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-sm font-medium"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>📷 Scan Report Card with AI</>
              )}
            </button>
            {scanPreview && !scanning && !scanModal && (
              <img src={scanPreview} alt="preview" className="mt-2 w-full rounded-lg object-cover max-h-32" />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            or add manually
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          <form onSubmit={addGrade} className="space-y-3">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Exam / Test Name</label>
              <input className="input" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Term 1 Test, Mid-year" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Score (%)</label>
                <input className="input" type="number" min="0" max="100" value={form.score}
                  onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="0-100" required />
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Saving...' : '+ Add Result'}
            </button>
          </form>
        </div>

        {/* Subject stats */}
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3 content-start">
          {stats.length === 0 ? (
            <div className="col-span-2 card text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">📊</p>
              <p>Add your first exam result to see stats</p>
            </div>
          ) : stats.map(({ subj, avg, latest, trend, count }) => {
            const color = SUBJECT_COLORS[subj] || '#6b7280'
            const sym = gradeSymbol(avg)
            return (
              <div key={subj} className="card border-l-4" style={{ borderLeftColor: color }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{subj}</span>
                  <span className="text-lg">{sym.emoji}</span>
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-2xl font-bold" style={{ color }}>{avg}%</div>
                    <div className="text-xs text-gray-500">avg · {count} result{count !== 1 ? 's' : ''}</div>
                  </div>
                  {trend !== null && (
                    <div className={`text-sm font-semibold ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
                    </div>
                  )}
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${avg}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Line chart */}
      {grades.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Performance Over Time</h2>
            <div className="flex gap-2 flex-wrap">
              {['All', ...subjects].map(s => (
                <button key={s} onClick={() => setActiveSubject(s)}
                  className={`text-xs px-3 py-1 rounded-full transition
                    ${activeSubject === s ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  style={activeSubject === s ? { background: SUBJECT_COLORS[s] || '#3b82f6' } : {}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* Grade history table */}
      {grades.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">All Results</h2>
          <div className="space-y-2">
            {[...grades].reverse().map(g => {
              const sym = gradeSymbol(g.score)
              const color = SUBJECT_COLORS[g.subject] || '#6b7280'
              return (
                <div key={g.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition group">
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{g.label}</span>
                      <span className="text-xs text-gray-400">{g.subject}</span>
                    </div>
                    <span className="text-xs text-gray-400">{g.date}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg" style={{ color }}>{g.score}%</div>
                    <div className="text-xs" style={{ color }}>{sym.emoji} {sym.label}</div>
                  </div>
                  <button onClick={() => deleteGrade(g.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition text-sm ml-2">
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
