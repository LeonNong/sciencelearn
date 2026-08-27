import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { parseMeanings } from './parseMeanings'

export default function ReviewTab() {
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
