import { useState, useEffect, useRef, useCallback } from 'react'

const DIFFICULTIES = [
  { level: 1, label: 'Easy',   desc: 'Next character always shown' },
  { level: 2, label: 'Medium', desc: 'Next character shown only on mistake' },
  { level: 3, label: 'Hard',   desc: 'One mistake restarts from beginning' },
]

function tokenize(text) {
  // Split into individual characters (preserving spaces and punctuation)
  return text.split('')
}

export default function MemoryType() {
  const [step, setStep] = useState('setup') // setup | game | complete
  const [rawText, setRawText] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [tokens, setTokens] = useState([])
  const [cursor, setCursor] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [restarts, setRestarts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [flash, setFlash] = useState(null) // 'correct' | 'wrong'
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  // Timer
  useEffect(() => {
    if (step === 'game') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [step, startTime])

  function startGame() {
    const cleaned = rawText.trim()
    if (!cleaned) return
    const t = tokenize(cleaned)
    setTokens(t)
    setCursor(0)
    setMistakes(0)
    setRestarts(0)
    setShowHint(difficulty === 1)
    setFlash(null)
    setStartTime(Date.now())
    setElapsed(0)
    setStep('game')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function restart() {
    setCursor(0)
    setShowHint(difficulty === 1)
    setFlash(null)
    setRestarts(r => r + 1)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = useCallback((e) => {
    if (step !== 'game') return
    // Ignore modifier keys, arrows, etc.
    if (e.key.length !== 1 && e.key !== 'Enter') return
    e.preventDefault()

    const expected = tokens[cursor]
    // Treat Enter as newline if text has newlines
    const typed = e.key === 'Enter' ? '\n' : e.key

    if (typed === expected) {
      setFlash('correct')
      setTimeout(() => setFlash(null), 120)
      const next = cursor + 1
      if (next >= tokens.length) {
        clearInterval(timerRef.current)
        setStep('complete')
      } else {
        setCursor(next)
        if (difficulty === 1) setShowHint(true)
        else setShowHint(false)
      }
    } else {
      setMistakes(m => m + 1)
      setFlash('wrong')
      setTimeout(() => setFlash(null), 300)
      if (difficulty === 2) {
        setShowHint(true)
        setTimeout(() => setShowHint(false), 1200)
      }
      if (difficulty === 3) {
        setTimeout(() => restart(), 400)
      }
    }
  }, [step, tokens, cursor, difficulty])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const progress = tokens.length ? Math.round((cursor / tokens.length) * 100) : 0
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Render typed / current / remaining text
  function renderText() {
    return tokens.map((ch, i) => {
      const display = ch === '\n' ? '↵\n' : ch
      if (i < cursor) {
        return <span key={i} className="text-green-500">{display}</span>
      }
      if (i === cursor) {
        return (
          <span key={i} className={`relative inline-block border-b-2 ${
            flash === 'correct' ? 'border-green-400 text-green-400'
            : flash === 'wrong' ? 'border-red-400 text-red-400 animate-pulse'
            : 'border-primary-500'
          }`}>
            {showHint
              ? <span className="text-primary-400 font-bold">{display === '↵\n' ? '↵' : display}</span>
              : <span className="text-gray-300 dark:text-gray-600">{'_'}</span>
            }
          </span>
        )
      }
      return <span key={i} className="text-gray-300 dark:text-gray-600">{display}</span>
    })
  }

  if (step === 'setup') return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📖 Memory Typing</h1>
        <p className="text-gray-500 text-sm mt-1">Paste any text and practise memorising it by typing — character by character.</p>
      </div>
      <div className="card space-y-5">
        <div>
          <label className="label">Paste your text</label>
          <textarea
            className="input resize-none font-mono text-sm"
            rows={8}
            placeholder="Paste notes, definitions, formulas, quotes — anything you want to memorise..."
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">{rawText.trim().length} characters</p>
        </div>

        <div>
          <label className="label">Difficulty</label>
          <div className="grid grid-cols-3 gap-3 mt-1">
            {DIFFICULTIES.map(d => (
              <button key={d.level} onClick={() => setDifficulty(d.level)}
                className={`p-3 rounded-xl border-2 text-left transition
                  ${difficulty === d.level
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                <div className={`font-bold text-sm ${
                  d.level === 1 ? 'text-green-600' : d.level === 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>{d.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={startGame} disabled={!rawText.trim()} className="btn-primary w-full py-3">
          Start Memorising →
        </button>
      </div>
    </div>
  )

  if (step === 'complete') return (
    <div className="max-w-md mx-auto text-center">
      <div className="card py-12">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Complete!</h2>
        <p className="text-gray-500 mt-2">You typed the entire text from memory.</p>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Time', val: fmt(elapsed) },
            { label: 'Mistakes', val: mistakes },
            { label: 'Restarts', val: restarts },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-700 rounded-xl py-3">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{s.val}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={startGame} className="flex-1 btn-primary py-2.5">Try Again</button>
          <button onClick={() => setStep('setup')} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">New Text</button>
        </div>
      </div>
    </div>
  )

  // Game screen
  return (
    <div className="max-w-3xl mx-auto" onClick={() => inputRef.current?.focus()}>
      {/* HUD */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
          difficulty === 1 ? 'bg-green-100 text-green-700' : difficulty === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>{DIFFICULTIES[difficulty - 1].label}</div>
        <div className="text-sm text-gray-500">⏱ {fmt(elapsed)}</div>
        <div className="text-sm text-gray-500">❌ {mistakes} mistakes</div>
        {difficulty === 3 && <div className="text-sm text-gray-500">🔄 {restarts} restarts</div>}
        <button onClick={() => setStep('setup')} className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← Exit</button>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Text display */}
      <div className={`card font-mono text-lg leading-relaxed whitespace-pre-wrap cursor-text select-none transition
        ${flash === 'wrong' ? 'ring-2 ring-red-400' : flash === 'correct' ? 'ring-2 ring-green-400' : ''}`}>
        {renderText()}
        <span className="inline-block w-0.5 h-5 bg-primary-500 animate-pulse ml-0.5 align-middle" />
      </div>

      {/* Hint line */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        {difficulty === 1 && '💡 Next character is always shown above'}
        {difficulty === 2 && '💡 Make a mistake to reveal the next character briefly'}
        {difficulty === 3 && '⚠️ One mistake restarts — good luck!'}
      </p>

      {/* Hidden input to capture focus on mobile */}
      <input ref={inputRef} className="opacity-0 absolute w-0 h-0" readOnly />
    </div>
  )
}
