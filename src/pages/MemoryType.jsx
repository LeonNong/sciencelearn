import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { evaluateText } from '../lib/memoryInput.mjs'

const DIFFICULTIES = [
  { level: 1, label: 'Easy',   desc: 'Current character always shown' },
  { level: 2, label: 'Medium', desc: 'Next char shown briefly on correct or wrong' },
  { level: 3, label: 'Hard',   desc: 'Wrong = see full text, must restart manually' },
]

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
  const [inputMode, setInputMode] = useState('keyboard')
  const [draft, setDraft] = useState('')
  const composing = useRef(false)
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

  useEffect(() => {
    function onKey(e) {
      if (step === 'revealed' && e.key === 'Enter') { e.preventDefault(); doRestart() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  function focusInput() {
    // iOS Safari requires focus() to be called synchronously in a user gesture
    inputRef.current?.focus()
  }

  function normalizePunctuation(str) {
    return str
      .replace(/\u2018|\u2019|\u201A|\u201B/g, "'")   // curly single quotes → '
      .replace(/\u201C|\u201D|\u201E|\u201F/g, '"')   // curly double quotes → "
      .replace(/\u2013/g, '-')                         // en dash → -
      .replace(/\u2014/g, '--')                        // em dash → --
      .replace(/\u2026/g, '...')                       // ellipsis → ...
      .replace(/\uFF0C/g, ',')                         // ，→ ,
      .replace(/\u3002/g, '.')                         // 。→ .
      .replace(/\uFF01/g, '!')                         // ！→ !
      .replace(/\uFF1F/g, '?')                         // ？→ ?
      .replace(/\uFF1A/g, ':')                         // ：→ :
      .replace(/\uFF1B/g, ';')                         // ；→ ;
      .replace(/\u300C|\u300D|\u300E|\u300F/g, '"')   // 「」『』→ "
      .replace(/\uFF08/g, '(').replace(/\uFF09/g, ')') // （）→ ()
  }

  function startGame() {
    const cleaned = normalizePunctuation(rawText.trim())
    if (!cleaned) return
    setTokens(cleaned.split(''))
    setCursor(0)
    setMistakes(0)
    setFlash(null)
    setHintChar(false)
    setStartTime(Date.now())
    setElapsed(0)
    setRestarts(0)
    setDraft('')
    composing.current = false
    flushSync(() => setStep('game'))
    focusInput()
  }

  function doRestart() {
    setCursor(0)
    setFlash(null)
    setHintChar(false)
    setRestarts(r => r + 1)
    setDraft('')
    composing.current = false
    flushSync(() => setStep('game'))
    focusInput()
  }

  function flashHint() {
    clearTimeout(hintTimer.current)
    setHintChar(true)
    hintTimer.current = setTimeout(() => setHintChar(false), 900)
  }

  function handleInput(e) {
    const value = e.currentTarget.value
    setDraft(value)
    if (inputMode === 'handwriting' || composing.current || e.nativeEvent.isComposing) return
    submitText(value)
  }

  function submitText(value) {
    if (step !== 'game' || composing.current || !value) return
    const result = evaluateText(tokens, cursor, normalizePunctuation(value), difficulty)
    setCursor(result.cursor)
    setMistakes(m => m + result.mistakes)
    setDraft('')
    setFlash(result.mistakes ? 'wrong' : 'correct')
    setTimeout(() => setFlash(null), result.mistakes ? 300 : 100)
    if (difficulty === 2) flashHint()
    if (result.step !== 'game') {
      clearInterval(timerRef.current)
      setStep(result.step)
    }
  }

  const progress = tokens.length ? Math.round((cursor / tokens.length) * 100) : 0
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  function renderGame() {
    return tokens.map((ch, i) => {
      const display = ch === '\n' ? '↵\n' : ch
      if (i < cursor) return <span key={i} className="text-green-500">{display}</span>
      if (i === cursor) {
        if (difficulty === 1) {
          return (
            <span key={i} className={`border-b-2 font-bold ${flash === 'correct' ? 'text-green-400 border-green-400' : flash === 'wrong' ? 'text-red-400 border-red-400' : 'text-primary-500 border-primary-500'}`}>
              {ch === '\n' ? '↵' : ch}
            </span>
          )
        }
        if (hintChar) return <span key={i} className="text-yellow-500 border-b-2 border-yellow-400 font-bold">{ch === '\n' ? '↵' : ch}</span>
        return <span key={i} className={`border-b-2 ${flash === 'wrong' ? 'border-red-400' : 'border-primary-500'}`}><span className="text-gray-300 dark:text-gray-600">_</span></span>
      }
      if (difficulty === 1) return <span key={i} className="text-gray-300 dark:text-gray-600">{display}</span>
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
                className={`p-3 rounded-xl border-2 text-left transition ${difficulty === d.level ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                <div className={`font-bold text-sm ${d.level === 1 ? 'text-green-600' : d.level === 2 ? 'text-yellow-600' : 'text-red-600'}`}>{d.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={startGame} disabled={!rawText.trim()} className="btn-primary w-full py-3">Start Memorising →</button>
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
          {[{ label: 'Time', val: fmt(elapsed) }, { label: 'Mistakes', val: mistakes }, { label: 'Restarts', val: restarts }].map(s => (
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
        <p className="text-xs text-gray-500 mt-1">or press Enter to restart</p>
      </div>
      <div className="card font-mono text-base leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200 select-text">
        {rawText.trim()}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${difficulty === 1 ? 'bg-green-100 text-green-700' : difficulty === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
          {DIFFICULTIES[difficulty - 1].label}
        </div>
        <div className="text-sm text-gray-500">⏱ {fmt(elapsed)}</div>
        <div className="text-sm text-gray-500">❌ {mistakes}</div>
        {difficulty === 3 && <div className="text-sm text-gray-500">🔄 {restarts}</div>}
        <div className="text-sm text-gray-500">{cursor}/{tokens.length}</div>
        <button onClick={() => setStep('setup')} className="ml-auto text-xs text-gray-400 hover:text-gray-600">← Exit</button>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div
        className={`card font-mono text-lg leading-relaxed whitespace-pre-wrap cursor-text select-none transition ${flash === 'wrong' ? 'ring-2 ring-red-400' : flash === 'correct' ? 'ring-2 ring-green-400' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {renderGame()}
        <span className="inline-block w-0.5 h-5 bg-primary-500 animate-pulse ml-0.5 align-middle" />
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        {difficulty === 1 && '💡 Current character is shown — type it to continue'}
        {difficulty === 2 && '💡 All hidden — next char flashes briefly on correct or wrong'}
        {difficulty === 3 && '⚠️ One mistake shows full text — restart manually'}
      </p>
      <div className="card mt-4 space-y-3">
        <div className="flex gap-2" role="group" aria-label="Input mode">
          {['keyboard', 'handwriting'].map(mode => (
            <button key={mode} type="button" aria-pressed={inputMode === mode}
              onClick={() => {
                if (mode !== inputMode) setDraft('')
                composing.current = false
                flushSync(() => setInputMode(mode))
                inputRef.current?.focus({ preventScroll: true })
              }}
              className={`px-4 py-2 rounded-lg text-sm ${inputMode === mode ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
              {mode === 'keyboard' ? 'Keyboard' : 'Apple Pencil / Handwriting'}
            </button>
          ))}
        </div>
        <label htmlFor="memory-answer" className="label">
          {inputMode === 'handwriting' ? 'Write your answer here' : 'Type your answer here'}
        </label>
        <textarea
          id="memory-answer"
          ref={inputRef}
          value={draft}
          onChange={handleInput}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={e => {
            composing.current = false
            if (inputMode === 'keyboard') submitText(e.currentTarget.value)
          }}
          className="input w-full text-base min-h-32"
          // Declare this before a stroke begins; cancelling pointer events can
          // interfere with native Scribble. Keep pinch zoom available.
          style={inputMode === 'handwriting' ? {
            touchAction: 'pinch-zoom',
            overscrollBehavior: 'contain',
            minHeight: '14rem',
          } : undefined}
          rows={inputMode === 'handwriting' ? 7 : 4}
          aria-describedby="memory-input-help"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <p id="memory-input-help" className="text-xs text-gray-500 dark:text-gray-400">
          {inputMode === 'handwriting'
            ? 'Write inside this answer box, not on the passage above. Enable Scribble in iPad Settings > Apple Pencil. Scroll the page outside the box. Correct the recognised text, including spaces and punctuation, then check it. You can submit part of the passage at a time.'
            : 'Characters are checked as you type. For Apple Pencil, select Handwriting above.'}
        </p>
        {inputMode === 'handwriting' && (
          <button type="button" onClick={() => submitText(draft)} disabled={!draft}
            className="btn-primary w-full py-3">Check answer</button>
        )}
      </div>
    </div>
  )
}
