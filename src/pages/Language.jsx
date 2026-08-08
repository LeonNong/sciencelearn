import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'French', 'Spanish', 'German', 'Mandarin', 'Portuguese']
const TABS = [
  { key: 'vocab',    label: '📖 Vocabulary' },
  { key: 'review',   label: '🔁 Review' },
  { key: 'quiz',     label: '🧪 Quiz' },
  { key: 'grammar',  label: '✏️ Grammar' },
  { key: 'writing',  label: '✍️ Writing' },
  { key: 'progress', label: '📊 Progress' },
]

export default function Language() {
  const [tab, setTab] = useState('vocab')
  const [lang, setLang] = useState('English')

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">🌐 Language Learning</h1>
        <select className="input w-auto py-1 text-sm" value={lang} onChange={e => setLang(e.target.value)}>
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1" style={{ borderBottom: '2px solid #1f2937' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium transition ${tab === t.key ? 'text-white border-b-2 border-primary-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vocab'    && <VocabTab lang={lang} />}
      {tab === 'review'   && <ReviewTab lang={lang} />}
      {tab === 'quiz'     && <QuizTab lang={lang} />}
      {tab === 'grammar'  && <GrammarTab lang={lang} />}
      {tab === 'writing'  && <WritingTab lang={lang} />}
      {tab === 'progress' && <ProgressTab />}
    </div>
  )
}

// ── Vocabulary Tab ──────────────────────────────────────────────
function VocabTab({ lang }) {
  const [vocab, setVocab] = useState([])
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.getLangVocab().then(setVocab).catch(() => {}) }, [])

  async function addWord(e) {
    e.preventDefault()
    if (!word.trim()) return
    setLoading(true); setError('')
    try {
      const entry = await api.generateVocab({ word: word.trim(), language: lang })
      setVocab(v => [entry, ...v])
      setWord('')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function remove(id) {
    await api.deleteVocab(id)
    setVocab(v => v.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addWord} className="flex gap-2">
        <input className="input flex-1" value={word} onChange={e => setWord(e.target.value)}
          placeholder={`Enter a ${lang} word to learn...`} />
        <button type="submit" disabled={loading} className="btn-primary px-4">
          {loading ? '...' : '+ Add'}
        </button>
      </form>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {vocab.map(v => (
          <div key={v.id} className="card space-y-2 group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-white font-bold text-sm">{v.word}</span>
                <span className="text-xs text-gray-500 ml-2 italic">{v.part_of_speech}</span>
                {v.translation && <span className="text-xs text-primary-400 ml-2">({v.translation})</span>}
              </div>
              <button onClick={() => remove(v.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 text-xs transition">�?/button>
            </div>
            <p className="text-gray-300 text-xs">{v.definition}</p>
            <p className="text-gray-500 text-xs italic">"{v.example}"</p>
            <div className="flex gap-2 text-xs">
              <span className="text-green-400">�?{v.correct}</span>
              <span className="text-red-400">�?{v.incorrect}</span>
            </div>
          </div>
        ))}
        {vocab.length === 0 && !loading && (
          <p className="col-span-2 text-center text-gray-500 py-8 text-xs">No words yet. Add your first word above.</p>
        )}
      </div>
    </div>
  )
}

// ── Spaced Repetition Review Tab ────────────────────────────────
function ReviewTab() {
  const [due, setDue] = useState([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.getLangVocab().then(vocab => {
      const now = new Date()
      setDue(vocab.filter(v => new Date(v.next_review) <= now))
    }).catch(() => {})
  }, [])

  async function rate(quality) {
    await api.reviewVocab(due[idx].id, quality)
    const next = idx + 1
    if (next >= due.length) setDone(true)
    else { setIdx(next); setFlipped(false) }
  }

  if (due.length === 0) return (
    <div className="card text-center py-12">
      <p className="text-4xl mb-3">🎉</p>
      <p className="text-white text-sm">No words due for review. Come back later!</p>
    </div>
  )

  if (done) return (
    <div className="card text-center py-12">
      <p className="text-4xl mb-3">�?/p>
      <p className="text-white text-sm font-bold">Session complete!</p>
      <button onClick={() => { setIdx(0); setFlipped(false); setDone(false) }} className="btn-primary mt-4 px-6">Review Again</button>
    </div>
  )

  const card = due[idx]
  return (
    <div className="max-w-md mx-auto space-y-4">
      <p className="text-xs text-gray-500 text-center">{idx + 1} / {due.length} due</p>
      <div className="card text-center cursor-pointer min-h-40 flex flex-col items-center justify-center gap-3"
        onClick={() => setFlipped(f => !f)}>
        {!flipped ? (
          <>
            <p className="text-white text-xl font-bold">{card.word}</p>
            <p className="text-xs text-gray-500">Click to reveal</p>
          </>
        ) : (
          <>
            <p className="text-primary-400 text-xs italic">{card.part_of_speech}</p>
            <p className="text-white text-sm">{card.definition}</p>
            <p className="text-gray-400 text-xs italic">"{card.example}"</p>
          </>
        )}
      </div>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {[{q:0,l:'Forgot',c:'bg-red-600'},{q:2,l:'Hard',c:'bg-orange-500'},{q:4,l:'Good',c:'bg-blue-500'},{q:5,l:'Easy',c:'bg-green-500'}].map(({q,l,c}) => (
            <button key={q} onClick={() => rate(q)} className={`${c} text-white text-xs font-bold py-2`}>{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Adaptive Quiz Tab ───────────────────────────────────────────
function QuizTab({ lang }) {
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
          <p className="text-xs"><span className="text-gray-500">Your answer: </span><span className={r.correct ? 'text-green-400' : 'text-red-400'}>{r.userAnswer || '(blank)'}</span></p>
          {!r.correct && <p className="text-xs"><span className="text-gray-500">Correct: </span><span className="text-green-400">{r.answer}</span></p>}
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
      <button onClick={generate} disabled={loading} className="btn-primary w-full">{loading ? 'Generating...' : '�?Generate Quiz'}</button>
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
            <input className="input text-xs" placeholder="Your answer..." value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
          )}
        </div>
      ))}
      <button onClick={submit} className="btn-primary w-full">�?Submit</button>
    </div>
  )
}

// ── Grammar Tab ─────────────────────────────────────────────────
function GrammarTab({ lang }) {
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
          <p className="text-xs"><span className="text-gray-500">Your answer: </span><span className={r.correct ? 'text-green-400' : 'text-red-400'}>{r.userAnswer || '(blank)'}</span></p>
          {!r.correct && <p className="text-xs"><span className="text-gray-500">Correct: </span><span className="text-green-400">{r.answer}</span></p>}
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
      <button onClick={generate} disabled={loading} className="btn-primary w-full">{loading ? 'Generating...' : '�?Generate Exercises'}</button>
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
            <input className="input text-xs" placeholder="Your answer..." value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
          )}
        </div>
      ))}
      <button onClick={submit} className="btn-primary w-full">�?Submit</button>
    </div>
  )
}

// ── Writing Tab ─────────────────────────────────────────────────
function WritingTab({ lang }) {
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const PROMPTS = [
    'Describe your daily routine.',
    'Write about your favourite place.',
    'What would you do with a million dollars?',
    'Describe a memorable experience.',
    'What are your goals for this year?',
  ]

  async function getFeedback() {
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      const res = await api.langWriting({ language: lang, prompt, text })
      setFeedback(res)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="label">Writing Prompt</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PROMPTS.map(p => (
            <button key={p} onClick={() => setPrompt(p)}
              className={`text-xs px-2 py-1 border transition ${prompt === p ? 'border-primary-500 text-primary-300 bg-primary-900/20' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
              {p}
            </button>
          ))}
        </div>
        <input className="input text-xs" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Or type your own prompt..." />
      </div>
      <div>
        <label className="label">Your Writing ({text.length} chars)</label>
        <textarea className="input resize-none text-xs" rows={6} value={text}
          onChange={e => setText(e.target.value)} placeholder={`Write in ${lang}...`} />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={getFeedback} disabled={loading || !text.trim()} className="btn-primary w-full">
        {loading ? '🤖 Analysing...' : '�?Get AI Feedback'}
      </button>

      {feedback && (
        <div className="space-y-3">
          <div className="card flex items-center gap-4">
            <div className="text-3xl font-bold" style={{ color: feedback.score >= 70 ? '#10b981' : feedback.score >= 50 ? '#f59e0b' : '#ef4444' }}>
              {feedback.score}%
            </div>
            <p className="text-gray-300 text-xs">{feedback.summary}</p>
          </div>
          {feedback.corrections?.length > 0 && (
            <div className="card">
              <h3 className="text-white text-xs font-bold mb-2">📝 Corrections</h3>
              {feedback.corrections.map((c, i) => (
                <div key={i} className="mb-2 text-xs">
                  <span className="text-red-400 line-through">{c.original}</span>
                  <span className="text-gray-500 mx-1">�?/span>
                  <span className="text-green-400">{c.corrected}</span>
                  <span className="text-gray-500 ml-2">({c.explanation})</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {feedback.strengths?.length > 0 && (
              <div className="card">
                <h3 className="text-green-400 text-xs font-bold mb-2">💪 Strengths</h3>
                {feedback.strengths.map((s, i) => <p key={i} className="text-gray-300 text-xs">�?{s}</p>)}
              </div>
            )}
            {feedback.improvements?.length > 0 && (
              <div className="card">
                <h3 className="text-yellow-400 text-xs font-bold mb-2">🎯 Improve</h3>
                {feedback.improvements.map((s, i) => <p key={i} className="text-gray-300 text-xs">�?{s}</p>)}
              </div>
            )}
          </div>
          {feedback.corrected_text && (
            <div className="card">
              <h3 className="text-primary-400 text-xs font-bold mb-2">�?Corrected Version</h3>
              <p className="text-gray-300 text-xs leading-relaxed">{feedback.corrected_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Progress Tab ─────────────────────────────────────────────────
function ProgressTab() {
  const [stats, setStats] = useState(null)
  const [vocab, setVocab] = useState([])

  useEffect(() => {
    api.langProgress().then(setStats).catch(() => {})
    api.getLangVocab().then(setVocab).catch(() => {})
  }, [])

  if (!stats) return <p className="text-gray-500 text-xs text-center py-8">Loading...</p>

  const accuracy = (stats.totalCorrect + stats.totalIncorrect) > 0
    ? Math.round((stats.totalCorrect / (stats.totalCorrect + stats.totalIncorrect)) * 100)
    : 0

  // Group vocab by mastery level
  const mastered  = vocab.filter(v => v.correct >= 3 && v.incorrect === 0)
  const learning  = vocab.filter(v => (v.correct > 0 || v.incorrect > 0) && !(v.correct >= 3 && v.incorrect === 0))
  const struggling = vocab.filter(v => v.incorrect > v.correct)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Words',  val: stats.total,    color: '#3b82f6', emoji: '📚' },
          { label: 'Mastered',     val: stats.mastered, color: '#10b981', emoji: '🏆' },
          { label: 'Due Today',    val: stats.dueNow,   color: '#f59e0b', emoji: '🔁' },
          { label: 'Accuracy',     val: accuracy + '%', color: '#8b5cf6', emoji: '🎯' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl">{s.emoji}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mastery breakdown */}
      <div className="card">
        <h3 className="text-white font-bold text-xs mb-3">Word Mastery</h3>
        <div className="space-y-2">
          {[
            { label: '🏆 Mastered',   words: mastered,   color: '#10b981' },
            { label: '📖 Learning',   words: learning,   color: '#3b82f6' },
            { label: '⚠️ Struggling', words: struggling, color: '#ef4444' },
          ].map(g => (
            <div key={g.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{g.label}</span>
                <span style={{ color: g.color }}>{g.words.length} words</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5">
                <div className="h-1.5 transition-all" style={{
                  width: stats.total ? `${(g.words.length / stats.total) * 100}%` : '0%',
                  background: g.color
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Struggling words list */}
      {struggling.length > 0 && (
        <div className="card">
          <h3 className="text-red-400 font-bold text-xs mb-3">⚠️ Words to Focus On</h3>
          <div className="flex flex-wrap gap-2">
            {struggling.map(v => (
              <span key={v.id} className="text-xs px-2 py-1 border border-red-800 text-red-400">
                {v.word} ({v.incorrect}�?
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

