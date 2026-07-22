import { useState, useEffect, useRef, useCallback } from 'react'

const DIFFICULTIES = [
  { level: 1, label: 'Easy',   desc: 'Current character always shown' },
  { level: 2, label: 'Medium', desc: 'Next char shown briefly on correct or wrong' },
  { level: 3, label: 'Hard',   desc: 'Wrong = see full text, must restart manually' },
]

function tokenize(text) {
  return text.split('')
}

export default function MemoryType() {
  const [step, setStep] = useState('setup')
  const [rawText, setRawText] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [tokens, setTokens] = useState([])
  const [cursor, setCursor] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [restarts, setRestarts] = useState(0)
  const [hintChar, setHintChar] = useState(false)
  const [flash, setFlash] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const hintTimer = useRef(null)

  useEffect(() => {
    if (step === 'game') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [step, startTime])

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function startGame() {
    const cleaned = rawText.trim()
    if (!cleaned) return
    setTokens(tokenize(cleaned))
    setCursor(0)
    setMistakes(0)
    setFlash(null)
    setHintChar(false)
    setStartTime(Date.now())
    setElapsed(0)
    setStep('game')
    focusInput()
  }

  function doRestart() {
    setCursor(0)
    setFlash(null)
    setHintChar(false)
    setRestarts(r => r + 1)
    setStep('game')
    focusInput()
  }

  function flashHint() {
    clearTimeout(hintTimer.current)
    setHintChar(true)
    hintTimer.current = setTimeout(() => setHintChar(false), 900)
  }

  // Handle input from the hidden text input (works on mobile & desktop)
  function handleInput(e) {
    if (step !== 'game') return
    const val = e.target.value
    if (!val) return
    // reset the input value so we always get new characters
    e.target.value = ''

    const typed = val[val.length - 1] // last character typed
    processChar(typed)
  }

  // Also handle keydown for desktop Enter key (newlines)
  function handleKeyDown(e) {
    if (step !== 'game') return
    if (e.key === 'Enter') {
      e.preventDefault()
      processChar('\n')
    }
  }

  function processChar(typed) {
    const expected = tokens[cursor]
    if (typed === expected) {
      setFlash('correct')
      setTimeout(() => setFlash(null), 100)
      const next = cursor + 1
      if (next >= tokens.length) {
        clearInterval(timerRef.current)
        setStep('complete')
        return
      }
      setCursor(next)
      if (difficulty === 2) flashHint()
    } else {
      setMistakes(m => m + 1)
      setFlash('wrong')
      setTimeout(() => setFlash(null), 300)
      if (difficulty === 2) flashHint()
      if (difficulty === 3) {
        clearInterval(timerRef.current)
        setStep('revealed')
      }
    }
  }

  const progress = tokens.length ? Math.round((cursor / tokens.length) * 100) : 0
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  function renderGame() {
    return tokens.map((ch, i) => {
      const display = ch === '\n' ? '↵\n' : ch
      if (i < cursor) {
        return <span key={i} className="text-green-500">{display}</span>
      }
      if (i === cursor) {
        if (difficulty === 1) {
          return (
            <span key={i} className={`border-b-2 font-bold transition
              ${flash === 'correct' ? 'text-green-400 border-green-400'
              : flash === 'wrong' ? 'text-red-400 border-red-400'
              : 'text-primary-500 border-primary-500'}`}>
              {ch === '\n' ? '↵' : ch}
            </span>
          )
        }
        if (hintChar) {
          return (
            <span key={i} className="text-yellow-500 border-b-2 border-yellow-400 font-bold">
              {ch === '\n' ? '↵' : ch}
            </span>
          )
        }
        return (
          <span key={i} className={`border-b-2 transition ${flash === 'wrong' ? 'border-red-400' : 'border-primary-500'}`}>
            <span className="text-gray-300 dark:text-gray-600">_</span>
          </span>
        )
      }
      if (difficulty === 1) {
        return <span key={i} className="text-gray-300 dark:text-gray-600">{display}</span>
      }
      return <span key={i} className="text-gray-200 dark:text-gray-700 select-none">{ch === '\n' ? '\n' : '·'}</span>
    })
  }

  if (step === 'setup') return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⌨️ Memory Typing</h1>
        <p className="text-gray-500 text-sm mt-1">Paste text and memorise it by typing every character from memory.</p>
      </div>
      <div className="card space-y-5">
        <div>
          <label className="label">Paste your text</label>
          <textarea className="input resize-none font-mono text-sm" rows={8}
            placeholder="Paste notes, definitions, formulas, quotes..."
            value={rawText} onChange={e => setRawText(e.target.value)} />
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
                <div className={`font-bold text-sm ${d.level === 1 ? 'text-green-600' : d.level === 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {d.label}
                </div>
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

  if (step === 'revealed') return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-bold text-red-700 dark:text-red-300">Wrong character — study the full text below</p>
            <p className="text-sm text-red-500">Mistakes this run: {mistakes} · Restarts: {restarts}</p>
          </div>
        </div>
        <button onClick={doRestart} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl transition">
          🔄 Restart from Beginning
        </button>
      </div>
      <div className="card font-mono text-base leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200 select-text">
        {rawText.trim()}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
          difficulty === 1 ? 'bg-green-100 text-green-700' : difficulty === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>{DIFFICULTIES[difficulty - 1].label}</div>
        <div className="text-sm text-gray-500">⏱ {fmt(elapsed)}</div>
        <div className="text-sm text-gray-500">❌ {mistakes}</div>
        {difficulty === 3 && <div className="text-sm text-gray-500">🔄 {restarts}</div>}
        <div className="text-sm text-gray-500">{cursor}/{tokens.length}</div>
        <button onClick={() => setStep('setup')} className="ml-auto text-xs text-gray-400 hover:text-gray-600">← Exit</button>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Tap area — focuses the hidden input on mobile */}
      <div
        className={`card font-mono text-lg leading-relaxed whitespace-pre-wrap cursor-text select-none transition
          ${flash === 'wrong' ? 'ring-2 ring-red-400' : flash === 'correct' ? 'ring-2 ring-green-400' : ''}`}
        onClick={focusInput}
      >
        {renderGame()}
        <span className="inline-block w-0.5 h-5 bg-primary-500 animate-pulse ml-0.5 align-middle" />
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        {difficulty === 1 && '💡 Current character is shown — type it to continue'}
        {difficulty === 2 && '💡 All hidden — next char flashes briefly on correct or wrong'}
        {difficulty === 3 && '⚠️ One mistake shows full text — restart manually'}
      </p>

      {/* Hidden input — works on both mobile (triggers keyboard) and desktop */}
      <input
        ref={inputRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="opacity-0 absolute w-0 h-0"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        type="text"
        inputMode="text"
      />

      {/* Mobile tap-to-type button */}
      <button
        onClick={focusInput}
        className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 text-sm lg:hidden"
      >
        Tap here to type ⌨️
      </button>
    </div>
  )
}

const DIFFICULTIES = [
  { level: 1, label: 'Easy',   desc: 'Current character always shown' },
  { level: 2, label: 'Medium', desc: 'Next char shown briefly on correct or wrong' },
  { level: 3, label: 'Hard',   desc: 'Wrong = see full text, must restart manually' },
]

function tokenize(text) {
  return text.split('')
}

export default function MemoryType() {
  const [step, setStep] = useState('setup') // setup | game | revealed | complete
  const [rawText, setRawText] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [tokens, setTokens] = useState([])
  const [cursor, setCursor] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [restarts, setRestarts] = useState(0)
  const [hintChar, setHintChar] = useState(false) // show next char hint briefly
  const [flash, setFlash] = useState(null) // 'correct' | 'wrong'
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const hintTimer = useRef(null)

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
    setTokens(tokenize(cleaned))
    setCursor(0)
    setMistakes(0)
    setFlash(null)
    setHintChar(false)
    setStartTime(Date.now())
    setElapsed(0)
    setStep('game')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function doRestart() {
    setCursor(0)
    setFlash(null)
    setHintChar(false)
    setRestarts(r => r + 1)
    setStep('game')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Show next-char hint briefly
  function flashHint() {
    clearTimeout(hintTimer.current)
    setHintChar(true)
    hintTimer.current = setTimeout(() => setHintChar(false), 900)
  }

  const handleKey = useCallback((e) => {
    if (step !== 'game') return
    if (e.key.length !== 1 && e.key !== 'Enter') return
    e.preventDefault()

    const expected = tokens[cursor]
    const typed = e.key === 'Enter' ? '\n' : e.key

    if (typed === expected) {
      // Correct
      setFlash('correct')
      setTimeout(() => setFlash(null), 100)
      const next = cursor + 1
      if (next >= tokens.length) {
        clearInterval(timerRef.current)
        setStep('complete')
        return
      }
      setCursor(next)
      // Difficulty 2: show hint briefly after correct
      if (difficulty === 2) flashHint()
    } else {
      // Wrong
      setMistakes(m => m + 1)
      setFlash('wrong')
      setTimeout(() => setFlash(null), 300)

      if (difficulty === 2) {
        // Show next char briefly
        flashHint()
      }
      if (difficulty === 3) {
        // Reveal full text and wait for manual restart
        clearInterval(timerRef.current)
        setStep('revealed')
      }
    }
  }, [step, tokens, cursor, difficulty])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const progress = tokens.length ? Math.round((cursor / tokens.length) * 100) : 0
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  function renderGame() {
    return tokens.map((ch, i) => {
      const display = ch === '\n' ? '↵\n' : ch

      // Already typed — show green
      if (i < cursor) {
        return <span key={i} className="text-green-500">{display}</span>
      }

      // Current character
      if (i === cursor) {
        // Easy: always show current char
        if (difficulty === 1) {
          return (
            <span key={i} className={`border-b-2 font-bold transition
              ${flash === 'correct' ? 'text-green-400 border-green-400'
              : flash === 'wrong' ? 'text-red-400 border-red-400'
              : 'text-primary-500 border-primary-500'}`}>
              {ch === '\n' ? '↵' : ch}
            </span>
          )
        }
        // Medium/Hard: show hint char or blank
        if (hintChar) {
          return (
            <span key={i} className="text-yellow-500 border-b-2 border-yellow-400 font-bold">
              {ch === '\n' ? '↵' : ch}
            </span>
          )
        }
        return (
          <span key={i} className={`border-b-2 transition
            ${flash === 'wrong' ? 'border-red-400' : 'border-primary-500'}`}>
            <span className="text-gray-300 dark:text-gray-600">_</span>
          </span>
        )
      }

      // Future chars — hidden for medium/hard, dim for easy
      if (difficulty === 1) {
        return <span key={i} className="text-gray-300 dark:text-gray-600">{display}</span>
      }
      return <span key={i} className="text-gray-200 dark:text-gray-700 select-none">{ch === '\n' ? '\n' : '·'}</span>
    })
  }

  // ── SETUP ─────────────────────────────────────────────
  if (step === 'setup') return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⌨️ Memory Typing</h1>
        <p className="text-gray-500 text-sm mt-1">Paste text and memorise it by typing every character from memory.</p>
      </div>
      <div className="card space-y-5">
        <div>
          <label className="label">Paste your text</label>
          <textarea className="input resize-none font-mono text-sm" rows={8}
            placeholder="Paste notes, definitions, formulas, quotes..."
            value={rawText} onChange={e => setRawText(e.target.value)} />
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
                <div className={`font-bold text-sm ${d.level === 1 ? 'text-green-600' : d.level === 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {d.label}
                </div>
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

  // ── COMPLETE ──────────────────────────────────────────
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

  // ── REVEALED (Hard mode mistake) ──────────────────────
  if (step === 'revealed') return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-bold text-red-700 dark:text-red-300">Wrong character — study the full text below</p>
            <p className="text-sm text-red-500">Mistakes this run: {mistakes} · Restarts: {restarts}</p>
          </div>
        </div>
        <button onClick={doRestart} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl transition">
          🔄 Restart from Beginning
        </button>
      </div>
      <div className="card font-mono text-base leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200 select-text">
        {rawText.trim()}
      </div>
    </div>
  )

  // ── GAME ──────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
          difficulty === 1 ? 'bg-green-100 text-green-700' : difficulty === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>{DIFFICULTIES[difficulty - 1].label}</div>
        <div className="text-sm text-gray-500">⏱ {fmt(elapsed)}</div>
        <div className="text-sm text-gray-500">❌ {mistakes}</div>
        {difficulty === 3 && <div className="text-sm text-gray-500">🔄 {restarts}</div>}
        <div className="text-sm text-gray-500">{cursor}/{tokens.length} chars</div>
        <button onClick={() => setStep('setup')} className="ml-auto text-xs text-gray-400 hover:text-gray-600">← Exit</button>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className={`card font-mono text-lg leading-relaxed whitespace-pre-wrap cursor-text select-none transition
        ${flash === 'wrong' ? 'ring-2 ring-red-400' : flash === 'correct' ? 'ring-2 ring-green-400' : ''}`}>
        {renderGame()}
        <span className="inline-block w-0.5 h-5 bg-primary-500 animate-pulse ml-0.5 align-middle" />
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        {difficulty === 1 && '💡 Current character is shown — type it to continue'}
        {difficulty === 2 && '💡 All hidden — next char flashes briefly on correct or wrong'}
        {difficulty === 3 && '⚠️ One mistake shows full text — you must restart manually'}
      </p>

      <input ref={inputRef} className="opacity-0 absolute w-0 h-0" readOnly />
    </div>
  )
}
