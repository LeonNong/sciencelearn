import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

export default function QuizTab({ lang }) {
  const [level, setLevel] = useState('intermediate')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [weakWords, setWeakWords] = useState([])

  useEffect(() => {
    api.getLangVocab().then(vocab => {
      setWeakWords(vocab.filter(v => v.incorrect > v.correct).map(v => v.word))
    }).catch(() => {})
  }, [])

  async function generate() {
    setLoading(true); setError(''); setResults(null); setAnswers({})
    try {
      const res = await api.langQuiz({ language: lang, level, weakWords })
      setQuestions(res.questions)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function submit() {
    const res = questions.map(q => {
      const ua = (answers[q.id] || '').trim().toLowerCase()
      const ca = (q.answer || '').trim().toLowerCase()
      const correct = q.type === 'mcq' ? ua === ca[0] || ua === ca : ua.includes(ca) || ca.includes(ua)
      return { ...q, userAnswer: answers[q.id] || '', correct }
    })
    setResults(res)
  }

  if (results) return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-3xl font-bold text-white">{results.filter(r => r.correct).length}/{results.length}</p>
        <p className="text-gray-400 text-xs mt-1">correct answers</p>
      </div>
      {results.map((r, i) => (
        <div key={r.id} className={`card border-l-4 ${r.correct ? 'border-green-500' : 'border-red-500'}`}>
          <p className="text-white text-xs font-bold mb-1">Q{i+1}. {r.question}</p>
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
      <button onClick={() => { setQuestions([]); setResults(null) }} className="btn-primary w-full">New Quiz</button>
    </div>
  )

  if (questions.length === 0) return (
    <div className="card space-y-4 max-w-sm mx-auto">
      <h2 className="text-white font-bold text-sm">Adaptive Quiz</h2>
      <p className="text-gray-500 text-xs">AI will focus on your weak words ({weakWords.length} identified).</p>
      <div>
        <label className="label">Level</label>
        <select className="input" value={level} onChange={e => setLevel(e.target.value)}>
          {['beginner','intermediate','advanced'].map(l => <option key={l}>{l}</option>)}
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? 'Generating...' : 'Generate Quiz'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="card">
          <p className="text-white text-xs font-bold mb-3">Q{i+1}. {q.question}</p>
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
      <button onClick={submit} className="btn-primary w-full">Submit Answers</button>
    </div>
  )
}
