import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { Line } from 'react-chartjs-2'
import {
  Chart, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// 可选科目列表，保证 AI 识别后的科目名能够对应到前端展示的选择项。
const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Mathematical Literacy',
  'English', 'English HL', 'Afrikaans', 'Afrikaans FAL', 'isiZulu', 'Life Orientation']

// 每个科目的折线图颜色，便于前端在图表中区分不同学科。
const SUBJECT_COLORS = {
  Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', 'English HL': '#ec4899', Afrikaans: '#f97316',
  'Afrikaans FAL': '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

// 根据分数返回对应的等级标签、颜色和 emoji，用于统计卡片和 tooltip 中展示。
function gradeSymbol(score) {
  if (score >= 80) return { label: 'Distinction', color: '#10b981', emoji: '🏆' }
  if (score >= 70) return { label: 'Merit', color: '#3b82f6', emoji: '🎉' }
  if (score >= 60) return { label: 'Adequate', color: '#f59e0b', emoji: '👍' }
  if (score >= 50) return { label: 'Moderate', color: '#f97316', emoji: '📚' }
  return { label: 'Below Pass', color: '#ef4444', emoji: '💪' }
}

// Parse a downloaded ADAM markbook HTML file and extract all assessments.
function parseAdamHtml(htmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlText, 'text/html')
  const results = []

  // Each subject section has an h3.subjectname
  const sections = doc.querySelectorAll('.section')
  sections.forEach(section => {
    const h3 = section.querySelector('h3.subjectname')
    if (!h3) return

    // Extract subject name — strip the percentage at the end e.g. "ENGLISH HL  59%"
    const rawSubject = h3.textContent.trim().replace(/\s+\d+%$/, '').trim()
    // Normalise to title case and map known variants
    const subjectMap = {
      'ENGLISH HL': 'English HL', 'ENGLISH': 'English',
      'AFRIKAANS FAL': 'Afrikaans FAL', 'AFRIKAANS': 'Afrikaans',
      'MATHEMATICS': 'Mathematics', 'MATHEMATICAL LITERACY': 'Mathematical Literacy',
      'LIFE SCIENCES': 'Biology', 'PHYSICAL SCIENCES': 'Physics',
      'LIFE ORIENTATION': 'Life Orientation', 'INFORMATION TECHNOLOGY': 'Information Technology',
      'ISIZULU': 'isiZulu', 'CHEMISTRY': 'Chemistry',
    }
    const subject = subjectMap[rawSubject] || rawSubject.charAt(0) + rawSubject.slice(1).toLowerCase()

    // Each assessment row has .assessment-description, .assessment-percent, .assessment-comment
    const rows = section.querySelectorAll('tr')
    rows.forEach(row => {
      const descEl = row.querySelector('.assessment-description')
      const pctEl = row.querySelector('.assessment-percent')
      if (!descEl || !pctEl) return

      const descText = descEl.textContent.trim() // e.g. "Unprepared Reading (11 May)"
      const pct = parseInt(pctEl.textContent.trim())
      if (isNaN(pct)) return

      // Extract date from parentheses e.g. "(11 May)" → try to build YYYY-MM-DD
      const dateMatch = descText.match(/\((\d{1,2}\s+\w+(?:\s+\d{4})?)\)$/)
      let date = new Date().toISOString().split('T')[0]
      if (dateMatch) {
        const parsed = new Date(dateMatch[1] + (dateMatch[1].match(/\d{4}$/) ? '' : ' 2025'))
        if (!isNaN(parsed)) date = parsed.toISOString().split('T')[0]
      }

      const label = descText.replace(/\s*\(.*\)$/, '').trim()
      const commentEl = row.querySelector('.assessment-comment')
      const comment = commentEl ? commentEl.textContent.trim() : null

      results.push({ subject, label, score: pct, date, comment })
    })
  })

  return results
}

// AI 扫描结果确认弹窗：展示模型识别出的成绩列表，允许用户在保存前修改或删除。
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
            <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 space-y-2 text-sm">
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center">
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

// Grade Tracker 主页面：负责保存、读取、扫描、统计和展示成绩数据。
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
  const [showUploadOptions, setShowUploadOptions] = useState(false)
  const fileRef = useRef()
  const cameraRef = useRef()
  const pdfRef = useRef()
  const adamRef = useRef()

  // Handle ADAM HTML file import
  async function handleAdamImport(file) {
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const extracted = parseAdamHtml(text)
      if (extracted.length === 0) return setError('No grades found in this file. Make sure it\'s an ADAM markbook page.')
      setScanModal(extracted)
    } catch (err) {
      setError('Failed to parse ADAM file: ' + err.message)
    }
  }

  // 将 PDF 的所有页面渲染成一张长图的 base64，用于发给 AI 扫描。
  async function pdfToBase64(file) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const scale = 2
    const canvases = []
    let totalHeight = 0
    let maxWidth = 0

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      canvases.push(canvas)
      totalHeight += viewport.height
      maxWidth = Math.max(maxWidth, viewport.width)
    }

    // Merge all pages into one tall canvas
    const merged = document.createElement('canvas')
    merged.width = maxWidth
    merged.height = totalHeight
    const ctx = merged.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, maxWidth, totalHeight)
    let y = 0
    for (const c of canvases) {
      ctx.drawImage(c, 0, y)
      y += c.height
    }
    return merged.toDataURL('image/jpeg', 0.9)
  }

  // 页面首次加载时，从后端拉取该用户已经保存的所有成绩记录。
  useEffect(() => { api.getGrades().then(setGrades).catch(() => {}) }, [])

  const subjects = [...new Set(grades.map(g => g.subject))]

  // 手动新增一条成绩记录，表单提交后会直接保存到后端数据库。
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

  // 删除某一条成绩记录，删除后同步更新前端状态。
  async function deleteGrade(id) {
    await api.deleteGrade(id)
    setGrades(prev => prev.filter(g => g.id !== id))
  }

  // 处理用户上传或拍摄的成绩单图片/PDF，转成 base64 后发给 AI 扫描接口。
  async function handleImageFile(file) {
    if (!file) return
    setScanning(true)
    setError('')
    try {
      let dataUrl
      if (file.type === 'application/pdf') {
        setScanPreview(null)
        dataUrl = await pdfToBase64(file)
      } else {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.readAsDataURL(file)
        })
        setScanPreview(dataUrl)
      }
      const base64 = dataUrl.split(',')[1]
      const result = await api.scanGrades(base64, 'image/jpeg')
      setScanModal(result.grades)
    } catch (err) {
      setError('AI scan failed: ' + err.message)
      setScanPreview(null)
    } finally {
      setScanning(false)
    }
  }

  // 用户确认扫描结果后，将每一条提取出来的成绩批量保存到数据库。
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

  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [confirmClear, setConfirmClear] = useState(false)

  function toggleSubject(subj) {
    setExpandedSubjects(prev => ({ ...prev, [subj]: !prev[subj] }))
  }

  async function clearAllGrades() {
    setLoading(true)
    try {
      await Promise.all(grades.map(g => api.deleteGrade(g.id)))
      setGrades([])
      setConfirmClear(false)
    } catch (err) { setError('Failed to clear grades: ' + err.message) }
    finally { setLoading(false) }
  }
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
        // store comment per data point for tooltip
        comments: allDates.map(d => {
          const g = subjGrades.find(g => g.date === d)
          return g ? (g.comment || null) : null
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

  // 统计每个科目的平均分、最新成绩和趋势，用于主页卡片展示。
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
          <div data-upload-panel>
            {/* hidden: gallery / any file */}
            <input ref={fileRef} type="file" accept="image/*"
              className="hidden" onChange={e => { setShowUploadOptions(false); handleImageFile(e.target.files[0]) }} />
            {/* hidden: direct camera capture */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => { setShowUploadOptions(false); handleImageFile(e.target.files[0]) }} />
            {/* hidden: PDF upload */}
            <input ref={pdfRef} type="file" accept="application/pdf"
              className="hidden" onChange={e => { setShowUploadOptions(false); handleImageFile(e.target.files[0]) }} />

            {scanning ? (
              <button disabled className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-primary-400 text-primary-600 dark:text-primary-400 text-sm font-medium">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                Scanning...
              </button>
            ) : (
              <button
                onClick={() => setShowUploadOptions(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-primary-400 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-sm font-medium"
              >
                📷 Scan Report Card with AI
              </button>
            )}

            {/* Upload options panel */}
            {showUploadOptions && !scanning && (
              <div data-upload-panel className="mt-2 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm">
                <button
                  onClick={() => cameraRef.current.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-200 dark:border-gray-600"
                >
                  <span className="text-xl">📸</span>
                  <div className="text-left">
                    <div className="font-medium">Take Photo</div>
                    <div className="text-xs text-gray-400">Open camera to photograph your report card</div>
                  </div>
                </button>
                <button
                  onClick={() => fileRef.current.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-xl">🖼️</span>
                  <div className="text-left">
                    <div className="font-medium">Choose from Gallery</div>
                    <div className="text-xs text-gray-400">Select an existing photo from your device</div>
                  </div>
                </button>
                <button
                  onClick={() => pdfRef.current.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-t border-gray-200 dark:border-gray-600"
                >
                  <span className="text-xl">📄</span>
                  <div className="text-left">
                    <div className="font-medium">Upload PDF</div>
                    <div className="text-xs text-gray-400">Select a PDF report card from your device</div>
                  </div>
                </button>
              </div>
            )}

            {scanPreview && !scanning && !scanModal && (
              <img src={scanPreview} alt="preview" className="mt-2 w-full rounded-lg object-cover max-h-32" />
            )}
          </div>

          {/* ADAM HTML import */}
          <input ref={adamRef} type="file" accept=".html,.htm"
            className="hidden" onChange={e => handleAdamImport(e.target.files[0])} />
          <button
            onClick={() => adamRef.current.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-yellow-500 text-yellow-400 hover:bg-yellow-900/20 transition text-sm font-medium"
          >
            🏫 Import from ADAM (HTML)
          </button>

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

      {/* Grade history — grouped by subject, collapsible */}
      {grades.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">All Results</h2>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Clear all?</span>
                <button onClick={clearAllGrades} disabled={loading}
                  className="text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 transition">
                  Yes, clear
                </button>
                <button onClick={() => setConfirmClear(false)}
                  className="text-xs px-3 py-1 btn-secondary">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)}
                className="text-xs px-3 py-1 text-red-400 border border-red-800 hover:bg-red-900/30 transition">
                🗑 Clear All
              </button>
            )}
          </div>
          <div className="space-y-2">
            {subjects.map(subj => {
              const subjGrades = [...grades].filter(g => g.subject === subj).reverse()
              const color = SUBJECT_COLORS[subj] || '#6b7280'
              const isOpen = expandedSubjects[subj] ?? false
              const avg = Math.round(subjGrades.reduce((a, b) => a + b.score, 0) / subjGrades.length)
              return (
                <div key={subj} className="border border-gray-700">
                  {/* Subject header row — click to toggle */}
                  <button
                    onClick={() => toggleSubject(subj)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-left"
                  >
                    <div className="w-2 h-5 flex-shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-white text-sm flex-1">{subj}</span>
                    <span className="text-xs text-gray-400">{subjGrades.length} result{subjGrades.length !== 1 ? 's' : ''}</span>
                    <span className="text-sm font-bold ml-3" style={{ color }}>{avg}%</span>
                    <span className="text-gray-500 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded rows */}
                  {isOpen && (
                    <div className="border-t border-gray-700 divide-y divide-gray-800">
                      {subjGrades.map(g => {
                        const sym = gradeSymbol(g.score)
                        return (
                          <div key={g.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-800 transition group">
                            <div className="flex-1 min-w-0">
                              <span className="text-white text-sm">{g.label}</span>
                              <span className="text-xs text-gray-500 ml-2">{g.date}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-sm" style={{ color }}>{g.score}%</span>
                              <span className="text-xs ml-2" style={{ color }}>{sym.emoji} {sym.label}</span>
                            </div>
                            <button onClick={() => deleteGrade(g.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition text-sm ml-2">
                              🗑
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
