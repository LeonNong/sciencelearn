import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import Loader from '../components/Loader'

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Chemistry', 'Other']
const DIFF_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard']
const DIFF_COLORS = ['', 'text-green-500', 'text-green-400', 'text-yellow-500', 'text-orange-500', 'text-red-500']

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-400' : score >= 30 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8 text-right">{score}</span>
    </div>
  )
}

function AddTopicModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ subject: 'Biology', topic: '', examDate: '', difficulty: 3 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.topic.trim() || !form.examDate) return setError('All fields required')
    setLoading(true)
    try {
      const t = await api.createLareTopic({ subject: form.subject, topic: form.topic, examDate: form.examDate, difficulty: form.difficulty })
      onAdd(t)
      onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Topic to LARE</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={form.subject} onChange={e => set('subject', e.target.value)}>
                {['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Exam Date</label>
              <input type="date" className="input" value={form.examDate} onChange={e => set('examDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]} required />
            </div>
          </div>
          <div>
            <label className="label">Topic Name</label>
            <input className="input" value={form.topic} onChange={e => set('topic', e.target.value)}
              placeholder="e.g. DNA Replication, Newton's Laws" required />
          </div>
          <div>
            <label className="label">How difficult is this topic for you?</label>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} onClick={() => set('difficulty', n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition
                    ${form.difficulty === n ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">{DIFF_LABELS[form.difficulty]}</p>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 py-2 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary py-2">{loading ? 'Adding...' : 'Add Topic'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StudyModal({ topic, onClose, onQuizDone }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('explanation')
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.generateLareContent(topic.id)
      .then(setContent)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [topic.id])

  async function submitQuiz() {
    if (!content) return
    let correct = 0
    content.quiz.forEach((q, i) => { if (quizAnswers[i] === q.answer) correct++ })
    setQuizSubmitted(true)
    try {
      await api.recordLareQuiz(topic.id, { correct, total: content.quiz.length })
      onQuizDone && onQuizDone(correct, content.quiz.length)
    } catch {}
  }

  const tabs = ['explanation', 'notes', 'mistakes', 'quiz', 'flashcards']
  const tabIcons = { explanation: '📖', notes: '📝', mistakes: '⚠️', quiz: '🧪', flashcards: '🃏' }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-xs text-primary-500 font-semibold uppercase tracking-wide">LARE Study Session</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{topic.topic}</h2>
            <p className="text-sm text-gray-500">{topic.subject} · Priority Score: <span className="font-bold text-primary-600">{topic.score}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition
                ${tab === t ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {tabIcons[t]} {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader />
              <p className="text-gray-500 text-sm">LARE is generating personalised content for {topic.topic}...</p>
            </div>
          )}
          {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}
          {content && !loading && (
            <>
              {tab === 'explanation' && (
                <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {content.explanation}
                </div>
              )}
              {tab === 'notes' && (
                <ul className="space-y-2">
                  {content.revision_notes?.map((note, i) => (
                    <li key={i} className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-800 dark:text-gray-200">
                      <span className="text-blue-500 font-bold">{i + 1}.</span>{note}
                    </li>
                  ))}
                </ul>
              )}
              {tab === 'mistakes' && (
                <ul className="space-y-2">
                  {content.common_mistakes?.map((m, i) => (
                    <li key={i} className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-gray-800 dark:text-gray-200">
                      <span className="text-orange-500">⚠️</span>{m}
                    </li>
                  ))}
                </ul>
              )}
              {tab === 'quiz' && (
                <div className="space-y-4">
                  {content.quiz?.map((q, i) => (
                    <div key={i} className="card">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                        <span className="text-primary-500 mr-2">Q{i + 1}.</span>{q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map(opt => {
                          const letter = opt[0]
                          const selected = quizAnswers[i] === letter
                          const isCorrect = quizSubmitted && letter === q.answer
                          const isWrong = quizSubmitted && selected && letter !== q.answer
                          return (
                            <button key={opt} disabled={quizSubmitted}
                              onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [i]: letter }))}
                              className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition
                                ${isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700'
                                : isWrong ? 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-600'
                                : selected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700'
                                : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 text-gray-700 dark:text-gray-200'}`}>
                              {opt} {isCorrect ? '✓' : isWrong ? '✗' : ''}
                            </button>
                          )
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="text-xs text-gray-500 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">{q.explanation}</p>
                      )}
                    </div>
                  ))}
                  {!quizSubmitted ? (
                    <button onClick={submitQuiz}
                      disabled={Object.keys(quizAnswers).length < (content.quiz?.length || 5)}
                      className="btn-primary w-full py-2.5">
                      Submit Quiz
                    </button>
                  ) : (
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                        {Object.entries(quizAnswers).filter(([i, a]) => a === content.quiz[i]?.answer).length} / {content.quiz.length}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Priority score will update on next load</p>
                    </div>
                  )}
                </div>
              )}
              {tab === 'flashcards' && (
                <div className="space-y-3">
                  {content.flashcards?.map((fc, i) => {
                    return <FlashCard key={i} front={fc.question} back={fc.answer} index={i} />
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FlashCard({ front, back, index }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div onClick={() => setFlipped(f => !f)} className="cursor-pointer">
      <div className={`card min-h-20 flex flex-col justify-center transition-all ${flipped ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
        <div className="text-xs text-gray-400 mb-1">{flipped ? 'Answer' : `Card ${index + 1} — click to reveal`}</div>
        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{flipped ? back : front}</p>
      </div>
    </div>
  )
}

export default function LARE() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [studyTopic, setStudyTopic] = useState(null)

  useEffect(() => {
    api.getLareTopics()
      .then(data => setTopics(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleAdd(t) {
    setTopics(prev => [t, ...prev].sort((a, b) => (b.score || 0) - (a.score || 0)))
  }

  async function handleDelete(id) {
    if (!confirm('Remove this topic?')) return
    await api.deleteLareTopic(id)
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  async function handleDifficultyUpdate(topic, newDiff) {
    const updated = await api.updateLareTopic(topic.id, { difficulty: newDiff })
    setTopics(prev => prev.map(t => t.id === updated.id ? updated : t).sort((a, b) => (b.score || 0) - (a.score || 0)))
  }

  function handleQuizDone() {
    // Refresh topics to get updated priority
    api.getLareTopics().then(data => setTopics(data)).catch(() => {})
  }

  const top = topics[0]

  if (loading) return <Loader className="py-20" />

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">⚡ LARE</h1>
            <p className="text-indigo-100 text-sm mt-1">LearnWay Adaptive Revision Engine</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-white/20 hover:bg-white/30 transition text-white px-4 py-2 rounded-xl text-sm font-semibold">
            + Add Topic
          </button>
        </div>

        {top && (
          <div className="mt-5 bg-white/15 rounded-xl p-4">
            <p className="text-xs text-indigo-200 uppercase tracking-wide font-semibold mb-1">Today's Highest Priority</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{top.topic}</p>
                <p className="text-indigo-200 text-sm">{top.subject} · {top.daysUntilExam ?? '?'} days to exam</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{top.score || calcDisplay(top)}</div>
                <div className="text-xs text-indigo-200">Priority Score</div>
              </div>
            </div>
            <button onClick={() => setStudyTopic(top)}
              className="mt-3 w-full bg-white text-indigo-700 font-semibold py-2 rounded-lg text-sm hover:bg-indigo-50 transition">
              🤖 Study This Now with AI
            </button>
          </div>
        )}
      </div>

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">⚡</p>
          <p className="font-semibold text-gray-600 dark:text-gray-300">No topics yet</p>
          <p className="text-sm mt-1">Add your exam topics and LARE will tell you what to study first</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 px-6 py-2">Add Your First Topic</button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 dark:text-white">Topic Priority Rankings</h2>
          {topics.map((t, i) => (
            <div key={t.id} className="card hover:shadow-md transition">
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                  ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-400' : i === 2 ? 'bg-yellow-400' : 'bg-gray-400'}`}>
                  {i + 1}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white">{t.topic}</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">{t.subject}</span>
                    <span className={`text-xs font-medium ${DIFF_COLORS[t.difficulty]}`}>{DIFF_LABELS[t.difficulty]}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Exam: {t.exam_date} · {t.daysUntilExam ?? '?'} days left ·
                    {t.quiz_total > 0 ? ` Score: ${Math.round((t.quiz_correct / t.quiz_total) * 100)}%` : ' No quiz yet'} ·
                    Revised {t.revision_count || 0}×
                  </div>
                  {/* Score breakdown */}
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Urgency</span><span className="font-medium">{t.U}</span></div>
                    <div className="flex justify-between"><span>Difficulty</span><span className="font-medium">{t.D}</span></div>
                    <div className="flex justify-between"><span>Error Rate</span><span className="font-medium">{Math.round(t.E)}</span></div>
                    <div className="flex justify-between"><span>Revision Gap</span><span className="font-medium">{t.R}</span></div>
                  </div>
                  <div className="mt-2">
                    <ScoreBar score={t.score || 0} />
                  </div>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => setStudyTopic(t)}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                    Study
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="text-gray-400 hover:text-red-500 transition text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddTopicModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {studyTopic && <StudyModal topic={studyTopic} onClose={() => setStudyTopic(null)} onQuizDone={handleQuizDone} />}
    </div>
  )
}

// Fallback display if score not computed client-side
function calcDisplay(t) { return '—' }
