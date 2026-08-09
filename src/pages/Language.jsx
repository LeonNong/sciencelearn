import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'French', 'Spanish', 'German', 'Mandarin', 'Portuguese']
const TABS = [
  { key: 'vocab',    label: 'Vocabulary' },
  { key: 'review',   label: 'Review' },
  { key: 'quiz',     label: 'Quiz' },
  { key: 'grammar',  label: 'Grammar' },
  { key: 'writing',  label: 'Writing' },
  { key: 'progress', label: 'Progress' },
]

export default function Language() {
  const [tab, setTab] = useState('vocab')
  const [lang, setLang] = useState('English')

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>Language Learning</h1>
        <select className="input w-auto py-1 text-sm" value={lang} onChange={e => setLang(e.target.value)}>
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1" style={{ borderBottom: '2px solid #3b82f6' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-2 text-xs font-medium transition"
            style={{
              color: tab === t.key ? '#e2e8f0' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #60a5fa' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vocab'    && <VocabTab lang={lang} />}
      {tab === 'review'   && <ReviewTab />}
      {tab === 'quiz'     && <QuizTab lang={lang} />}
      {tab === 'grammar'  && <GrammarTab lang={lang} />}
      {tab === 'writing'  && <WritingTab lang={lang} />}
      {tab === 'progress' && <ProgressTab />}
    </div>
  )
}

// Helper: parse definition field which may be JSON array of meanings or plain string
function parseMeanings(definition) {
  if (!definition) return []
  try {
    const parsed = JSON.parse(definition)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ part_of_speech: '', pos_abbr: '', definition, example: '' }]
}

function VocabTab({ lang }) {
  const [vocab, setVocab] = useState([])
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flipped, setFlipped] = useState({})
  const [refreshing, setRefreshing] = useState({})

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

  async function refresh(id) {
    setRefreshing(r => ({ ...r, [id]: true }))
    try {
      const updated = await api.refreshVocab(id)
      setVocab(v => v.map(x => x.id === id ? updated : x))
      setFlipped(f => ({ ...f, [id]: false }))
    } catch (err) { setError(err.message) }
    finally { setRefreshing(r => ({ ...r, [id]: false })) }
  }

  function flip(id) { setFlipped(f => ({ ...f, [id]: !f[id] })) }

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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vocab.map(v => {
          const meanings = parseMeanings(v.definition)
          const isFlipped = flipped[v.id]
          return (
            <div key={v.id}
              className="card group cursor-pointer select-none"
              style={{ minHeight: 160, display: 'flex', flexDirection: 'column' }}
              onClick={() => flip(v.id)}>

              {/* Card front */}
              {!isFlipped ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-white font-bold text-base">{v.word}</span>
                      <span className="ml-2 text-xs" style={{ color: '#60a5fa' }}>
                        {meanings.map(m => m.pos_abbr).filter(Boolean).join(' / ')}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                      <button onClick={() => refresh(v.id)} disabled={refreshing[v.id]}
                        className="text-xs px-1.5 py-0.5 border border-gray-600 text-gray-400 hover:text-primary-400 hover:border-primary-500 transition"
                        title="Refresh / re-check with AI">
                        {refreshing[v.id] ? '...' : 'AI'}
                      </button>
                      <button onClick={() => remove(v.id)}
                        className="text-xs px-1.5 py-0.5 border border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-700 transition">
                        X
                      </button>
                    </div>
                  </div>
                  {v.translation && v.translation.trim() && (
                    <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{v.translation}</p>
                  )}
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <div className="flex gap-2 text-xs">
                      <span style={{ color: '#10b981' }}>{v.correct}✓</span>
                      <span style={{ color: '#ef4444' }}>{v.incorrect}✗</span>
                    </div>
                    <span className="text-xs" style={{ color: '#374151' }}>flip →</span>
                  </div>
                </div>
              ) : (
                /* Card back — show all meanings */
                <div className="flex-1 overflow-y-auto space-y-3">
                  {v.translation && v.translation.trim() && (
                    <p className="text-xs pb-2 border-b border-gray-700" style={{ color: '#94a3b8' }}>
                      {v.translation}
                    </p>
                  )}
                  {meanings.map((m, i) => (
                    <div key={i} className={i > 0 ? 'pt-2 border-t border-gray-700' : ''}>
                      {m.pos_abbr && (
                        <span className="text-xs font-bold mr-1" style={{ color: '#60a5fa' }}>{m.pos_abbr}</span>
                      )}
                      <span className="text-white text-xs">{m.definition}</span>
                      {m.example && (
                        <p className="text-xs mt-1 italic" style={{ color: '#6b7280' }}>"{m.example}"</p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs pt-1" style={{ color: '#4b5563' }}>tap to flip back</p>
                </div>
              )}
            </div>
          )
        })}
        {vocab.length === 0 && !loading && (
          <p className="col-span-full text-center py-8 text-xs" style={{ color: '#6b7280' }}>
            No words yet. Add your first word above.
          </p>
        )}
      </div>
    </div>
  )
}

// ── 百词斩风格 Review Tab ────────────────────────────────────────
function ReviewTab() {
  const [all, setAll] = useState([])
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('show')
  const [streak, setStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const [choice, setChoice] = useState(null)
  const [mode, setMode] = useState(null) // null = not started

  useEffect(() => {
    api.getLangVocab().then(vocab => {
      setAll(vocab)
    }).catch(() => {})
  }, [])

  function startReview(reviewAll) {
    const pool = reviewAll
      ? all
      : all.filter(v => {
          if (!v.next_review) return true
          // Add 5 min buffer to account for clock differences
          return new Date(v.next_review) <= new Date(Date.now() + 5 * 60 * 1000)
        })
    setQueue([...pool].sort(() => Math.random() - 0.5))
    setIdx(0); setPhase('show'); setChoice(null)
    setDone(false); setStreak(0); setCorrect(0)
    setMode(reviewAll ? 'all' : 'due')
  }

  function buildChoices(card) {
    const cardDef = parseMeanings(card.definition)[0]?.definition || card.definition
    const pool = all.filter(v => v.id !== card.id && v.definition)
    const wrong = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      .map(v => parseMeanings(v.definition)[0]?.definition || v.definition)
    // If not enough wrong choices, pad with generic distractors
    while (wrong.length < 3) wrong.push(`Meaning ${wrong.length + 1}`)
    return [...wrong, cardDef].sort(() => Math.random() - 0.5)
  }

  async function answer(selected) {
    const card = queue[idx]
    const cardDef = parseMeanings(card.definition)[0]?.definition || card.definition
    const isCorrect = selected === cardDef
    setChoice({ selected, correct: cardDef, isCorrect })
    setPhase('result')
    const quality = isCorrect ? 5 : 0
    await api.reviewVocab(card.id, quality)
    if (isCorrect) setStreak(s => s + 1); else setStreak(0)
    if (isCorrect) setCorrect(c => c + 1)
  }

  function next() {
    if (idx + 1 >= queue.length) { setDone(true); return }
    setIdx(i => i + 1)
    setPhase('show')
    setChoice(null)
  }

  // Start screen
  if (mode === null) {
    const dueCount = all.filter(v => {
      if (!v.next_review) return true
      return new Date(v.next_review) <= new Date(Date.now() + 5 * 60 * 1000)
    }).length
    return (
      <div className="max-w-sm mx-auto card text-center space-y-4 py-8">
        <p className="text-white font-bold text-sm">Review Mode</p>
        <p className="text-gray-400 text-xs">{all.length} total words · {dueCount} due</p>
        <div className="space-y-2">
          <button onClick={() => startReview(false)} className="btn-primary w-full"
            disabled={dueCount === 0}>
            Review Due ({dueCount})
          </button>
          <button onClick={() => startReview(true)} className="btn-secondary w-full"
            disabled={all.length === 0}>
            Review All ({all.length})
          </button>
        </div>
        {all.length === 0 && <p className="text-gray-500 text-xs">Add words in Vocabulary tab first.</p>}
      </div>
    )
  }

  if (queue.length === 0) return (
    <div className="card text-center py-12 space-y-3">
      <p className="text-4xl">🎉</p>
      <p className="text-white text-sm">No words to review!</p>
      <button onClick={() => setMode(null)} className="btn-secondary px-6">Back</button>
    </div>
  )

  if (done) return (
    <div className="card text-center py-12 space-y-3">
      <p className="text-4xl">✅</p>
      <p className="text-white font-bold">Session complete!</p>
      <p className="text-green-400 text-sm">{correct} / {queue.length} correct</p>
      <div className="flex gap-2 justify-center">
        <button onClick={() => startReview(mode === 'all')} className="btn-primary px-6">Again</button>
        <button onClick={() => setMode(null)} className="btn-secondary px-4">Menu</button>
      </div>
    </div>
  )

  const card = queue[idx]
  const choices = phase !== 'show' ? buildChoices(card) : []
  const progress = ((idx) / queue.length) * 100

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-800 h-2">
          <div className="h-2 bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-500">{idx}/{queue.length}</span>
        {streak >= 2 && <span className="text-xs text-orange-400">🔥 {streak}</span>}
      </div>

      {/* Word card */}
      <div className="card text-center space-y-3 py-8">
        <p className="text-primary-400 text-xs">{card.language} · {card.part_of_speech}</p>
        <p className="text-white text-3xl font-bold">{card.word}</p>
        {card.translation && <p className="text-gray-500 text-xs">({card.translation})</p>}
        {phase === 'show' && (
          <button onClick={() => setPhase('choices')} className="btn-primary px-6 mt-2">
            What does this mean?
          </button>
        )}
      </div>

      {/* Multiple choice */}
      {phase === 'choices' && (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs text-center">Choose the correct meaning:</p>
          {choices.map((c, i) => (
            <button key={i} onClick={() => answer(c)}
              className="w-full text-left px-4 py-3 text-xs border border-gray-700 text-gray-200 hover:bg-gray-800 hover:border-primary-500 transition">
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {phase === 'result' && choice && (
        <div className="space-y-3">
          <div className={`card border-l-4 ${choice.isCorrect ? 'border-green-500' : 'border-red-500'}`}>
            <p className={`text-sm font-bold mb-1 ${choice.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {choice.isCorrect ? 'Correct!' : 'Not quite'}
            </p>
            {!choice.isCorrect && (
              <p className="text-xs text-gray-300">Correct meaning: <span className="text-green-400">{choice.correct}</span></p>
            )}
            {card.example && <p className="text-xs text-gray-500 mt-1 italic">"{card.example}"</p>}
          </div>
          <button onClick={next} className="btn-primary w-full">
            {idx + 1 >= queue.length ? 'Finish' : 'Next Word'}
          </button>
        </div>
      )}
    </div>
  )
}

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

function WritingTab({ lang }) {
  const [nativeLang] = useState(() => localStorage.getItem('sl_home_lang') || 'English')
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState({}) // track which words were added to vocab

  async function analyse() {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.langWriting({ language: lang, nativeLanguage: nativeLang, prompt, text })
      setResult(res)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addToVocab(word) {
    try {
      await api.generateVocab({ word: word.translation, language: lang })
      setAdded(a => ({ ...a, [word.original]: true }))
    } catch (err) { setError('Failed to add: ' + err.message) }
  }

  // Highlight native words in the original text
  function renderHighlighted() {
    if (!result?.native_words?.length) return <span className="text-gray-300">{text}</span>
    let remaining = text
    const parts = []
    result.native_words.forEach((w, i) => {
      const idx = remaining.toLowerCase().indexOf(w.original.toLowerCase())
      if (idx === -1) return
      if (idx > 0) parts.push(<span key={`t${i}`} className="text-gray-300">{remaining.slice(0, idx)}</span>)
      parts.push(
        <span key={`h${i}`} className="bg-yellow-500/30 text-yellow-300 border-b border-yellow-400 cursor-help"
          title={`${lang}: ${w.translation}`}>
          {remaining.slice(idx, idx + w.original.length)}
        </span>
      )
      remaining = remaining.slice(idx + w.original.length)
    })
    if (remaining) parts.push(<span key="end" className="text-gray-300">{remaining}</span>)
    return parts
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1">
          <label className="label">Writing language</label>
          <select className="input text-xs" value={lang} disabled>
            <option>{lang}</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Home language</label>
          <select className="input text-xs" value={nativeLang} disabled>
            <option>{nativeLang}</option>
          </select>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Change in Settings</p>
        </div>
      </div>

      <div className="card border border-primary-900/50" style={{ background: '#0f172a' }}>
        <p className="text-primary-400 text-xs mb-2">Tip: Write in {lang}. For words you don't know, just write them in {nativeLang} — AI will translate and highlight them for you to learn.</p>
      </div>

      <div>
        <label className="label">Topic (optional — leave blank to free write)</label>
        <input className="input text-xs" value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder={`e.g. My daily routine, A memorable trip, My favourite food...`} />
      </div>

      <div>
        <label className="label">Your writing</label>
        <textarea className="input resize-none text-xs" rows={6} value={text}
          onChange={e => { setText(e.target.value); setResult(null) }}
          placeholder={`Mix ${lang} and ${nativeLang} — e.g. "I love to 跑步 every morning..."`} />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={analyse} disabled={loading || !text.trim()} className="btn-primary w-full">
        {loading ? 'Analysing...' : 'Analyse Writing'}
      </button>

      {result && (
        <div className="space-y-4">
          {/* AI detection warning */}
          {result.ai_score > 60 && (
            <div className="card border border-orange-800" style={{ background: '#1c1008' }}>
              <p className="text-orange-400 text-xs font-bold mb-1">AI Content Detected ({result.ai_score}%)</p>
              <p className="text-orange-300 text-xs">{result.ai_warning}</p>
              <p className="text-gray-500 text-xs mt-1">Try writing more naturally in your own voice.</p>
            </div>
          )}

          {/* Highlighted text */}
          <div className="card">
            <p className="text-gray-400 text-xs mb-2 font-bold">Your text with highlights:</p>
            <p className="text-xs leading-relaxed">{renderHighlighted()}</p>
          </div>

          {/* Native words → vocab */}
          {result.native_words?.length > 0 && (
            <div className="card space-y-3">
              <p className="text-yellow-400 text-xs font-bold">{result.native_words.length} word{result.native_words.length !== 1 ? 's' : ''} to learn:</p>
              {result.native_words.map((w, i) => (
                <div key={i} className="flex items-start gap-3 p-2 border border-gray-700">
                  <div className="flex-1">
                    <span className="text-yellow-300 text-xs font-bold">{w.original}</span>
                    <span className="text-gray-500 text-xs mx-2">→</span>
                    <span className="text-green-400 text-xs font-bold">{w.translation}</span>
                    <p className="text-gray-400 text-xs mt-0.5">{w.definition}</p>
                    {w.example && <p className="text-gray-600 text-xs italic">"{w.example}"</p>}
                  </div>
                  <button
                    onClick={() => addToVocab(w)}
                    disabled={added[w.original]}
                    className={`text-xs px-2 py-1 shrink-0 transition ${added[w.original] ? 'text-green-500 border border-green-800' : 'btn-primary'}`}>
                    {added[w.original] ? 'Added' : '+ Vocab'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          <div className="card space-y-2">
            <p className="text-white text-xs font-bold">Feedback</p>
            <p className="text-gray-300 text-xs">{result.feedback}</p>
            {result.strengths?.length > 0 && (
              <div>
                <p className="text-green-400 text-xs font-bold mt-2">Strengths</p>
                {result.strengths.map((s, i) => <p key={i} className="text-gray-400 text-xs">- {s}</p>)}
              </div>
            )}
            {result.suggestions?.length > 0 && (
              <div>
                <p className="text-yellow-400 text-xs font-bold mt-2">Suggestions</p>
                {result.suggestions.map((s, i) => <p key={i} className="text-gray-400 text-xs">- {s}</p>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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

  const mastered  = vocab.filter(v => v.correct >= 3 && v.incorrect === 0)
  const learning  = vocab.filter(v => (v.correct > 0 || v.incorrect > 0) && !(v.correct >= 3 && v.incorrect === 0))
  const struggling = vocab.filter(v => v.incorrect > v.correct)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Words', val: stats.total,    color: '#3b82f6' },
          { label: 'Mastered',    val: stats.mastered, color: '#10b981' },
          { label: 'Due Today',   val: stats.dueNow,   color: '#f59e0b' },
          { label: 'Accuracy',    val: accuracy + '%', color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-white font-bold text-xs mb-3">Word Mastery</h3>
        <div className="space-y-2">
          {[
            { label: 'Mastered',   words: mastered,   color: '#10b981' },
            { label: 'Learning',   words: learning,   color: '#3b82f6' },
            { label: 'Struggling', words: struggling, color: '#ef4444' },
          ].map(g => (
            <div key={g.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{g.label}</span>
                <span style={{ color: g.color }}>{g.words.length} words</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5">
                <div className="h-1.5" style={{
                  width: stats.total ? `${(g.words.length / stats.total) * 100}%` : '0%',
                  background: g.color
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {struggling.length > 0 && (
        <div className="card">
          <h3 className="text-red-400 font-bold text-xs mb-3">Words to Focus On</h3>
          <div className="flex flex-wrap gap-2">
            {struggling.map(v => (
              <span key={v.id} className="text-xs px-2 py-1 border border-red-800 text-red-400">
                {v.word} ({v.incorrect} wrong)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
