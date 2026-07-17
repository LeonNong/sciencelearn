import { useState } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['Biology', 'Chemistry', 'Physics']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const TYPES = ['mixed', 'mcq', 'short']

export default function Quiz() {
  const [step, setStep] = useState('setup') // setup | quiz | results
  const [config, setConfig] = useState({ subject: 'Biology', topic: '', difficulty: 'medium', count: 5, type: 'mixed' })
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  async function generate() {
    if (!config.topic.trim()) return setError('Please enter a topic')
    setError(''); setLoading(true)
    try {
      const res = await api.generateQuiz(config)
      setQuestions(res.questions)
      setAnswers({})
      setStep('quiz')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function submit() {
    setLoading(true)
    try {
      const res = await api.checkQuiz({ subject: config.subject, topic: config.topic, questions, answers })
      setResults(res)
      setStep('results')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const pct = results ? Math.round((results.score / results.total) * 100) : 0

  if (step === 'setup') return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">🧪 Quiz Generator</h1>
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={config.subject} onChange={e => set('subject', e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={config.difficulty} onChange={e => set('difficulty', e.target.value)}>
              {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Topic</label>
          <input className="input" value={config.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Cell division, Acids and Bases, Forces" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Questions</label>
            <select className="input" value={config.count} onChange={e => set('count', Number(e.target.value))}>
              {[3,5,10].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={config.type} onChange={e => set('type', e.target.value)}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={generate} disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? '✨ Generating Quiz...' : '✨ Generate Quiz'}
        </button>
      </div>
    </div>
  )

  if (step === 'quiz') return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{config.subject} — {config.topic}</h1>
        <span className="text-sm text-gray-500">{Object.keys(answers).length}/{questions.length} answered</span>
      </div>
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id} className="card">
            <p className="font-semibold text-gray-900 dark:text-white mb-3">
              <span className="text-primary-500 mr-2">Q{i + 1}.</span>{q.question}
            </p>
            {q.type === 'mcq' ? (
              <div className="space-y-2">
                {q.options.map(opt => {
                  const letter = opt[0]
                  const selected = answers[q.id] === letter
                  return (
                    <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.id]: letter }))}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition
                        ${selected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            ) : (
              <textarea
                className="input resize-none" rows={3}
                placeholder="Type your answer here..."
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      <button onClick={submit} disabled={loading} className="btn-primary w-full mt-6 py-3">
        {loading ? '🤖 Marking...' : '✅ Submit Answers'}
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`card text-center mb-6 ${pct >= 70 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
        <div className="text-5xl mb-2">{pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '📚' : '💪'}</div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</h2>
        <p className="text-gray-600 dark:text-gray-300">{results.score}/{results.total} correct · +{results.xpEarned} XP earned</p>
      </div>
      <div className="space-y-4">
        {results.results.map((r, i) => {
          const q = questions.find(q => q.id === r.id)
          return (
            <div key={r.id} className={`card border-l-4 ${r.correct ? 'border-green-500' : 'border-red-500'}`}>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Q{i+1}. {q?.question}</p>
              <p className="text-sm mt-1"><span className="text-gray-500">Your answer:</span> <span className={r.correct ? 'text-green-600' : 'text-red-500'}>{r.userAnswer || '(no answer)'}</span></p>
              {!r.correct && <p className="text-sm"><span className="text-gray-500">Correct:</span> <span className="text-green-600">{r.correctAnswer}</span></p>}
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 dark:bg-gray-700 rounded p-2">{r.feedback}</p>
            </div>
          )
        })}
      </div>
      <button onClick={() => setStep('setup')} className="btn-primary w-full mt-6">Try Another Quiz</button>
    </div>
  )
}
