import { useState } from 'react'
import { api } from '../../lib/api'

export default function GrammarTab({ lang }) {
  const [type, setType] = useState('mixed')
  const [exercises, setExercises] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError(''); setResults(null); setAnswers({})
    try {
      const res = await api.langGrammar({ language: lang, type })
      setExercises(res.exercises)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function submit() {
    const res = exercises.map(q => {
      const ua = (answers[q.id] || '').trim().toLowerCase()
      const ca = q.answer.trim().toLowerCase()
      const correct = q.type === 'mcq' ? ua === ca[0] || ua === ca : ua === ca || ca.includes(ua)
      return { ...q, userAnswer: answers[q.id] || '', correct }
    })
    setResults(res)
  }

  if (results) return (
    <div className="space-y-3">
      <div className="card text-center">
        <p className="text-2xl font-bold text-white">{results.filter(r => r.correct).length}/{results.length}</p>
        <p className="text-gray-400 text-xs">correct</p>
      </div>
      {results.map((r, i) => (
        <div key={r.id} className={`card border-l-4 ${r.correct ? 'border-green-500' : 'border-red-500'}`}>
          <p className="text-gray-400 text-xs mb-1">{r.instruction}</p>
          <p className="text-white text-xs font-medium mb-2">"{r.sentence}"</p>
          <p className="text-xs">
            <span className="text-gray-500">Your answer: </span>
            <span className={r.correct ? 'text-green-400' : 'text-red-400'}>{r.userAnswer || '(blank)'}</span>
          </p>
          {!r.correct && (
            <p className="text-xs">
              <span className="text-gray-500">Correct: </span>
              <span className="text-green-400">{r.answer}</span>
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1 italic">{r.explanation}</p>
        </div>
      ))}
      <button onClick={() => { setExercises([]); setResults(null) }} className="btn-primary w-full">New Exercises</button>
    </div>
  )

  if (exercises.length === 0) return (
    <div className="card space-y-4 max-w-sm mx-auto">
      <h2 className="text-white font-bold text-sm">Grammar Practice</h2>
      <div>
        <label className="label">Exercise Type</label>
        <select className="input" value={type} onChange={e => setType(e.target.value)}>
          {['mixed','mcq','fill','correct'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? 'Generating...' : 'Generate Exercises'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {exercises.map((q, i) => (
        <div key={q.id} className="card">
          <p className="text-gray-400 text-xs mb-1">{q.instruction}</p>
          <p className="text-white text-sm font-medium mb-3">"{q.sentence}"</p>
          {q.type === 'mcq' ? (
            <div className="space-y-2">
              {q.options.map(opt => {
                const letter = opt[0]
                const selected = answers[q.id] === letter
                return (
                  <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.id]: letter }))}
                    className={`w-full text-left px-3 py-2 text-xs border transition ${selected ? 'border-primary-500 bg-primary-900/30 text-primary-300' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
          ) : (
            <input className="input text-xs" placeholder="Your answer..."
              value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
          )}
        </div>
      ))}
      <button onClick={submit} className="btn-primary w-full">Submit</button>
    </div>
  )
}
