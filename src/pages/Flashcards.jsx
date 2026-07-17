import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['Biology', 'Chemistry', 'Physics']

export default function Flashcards() {
  const [cards, setCards] = useState([])
  const [tab, setTab] = useState('browse') // browse | review | create | generate
  const [flipped, setFlipped] = useState({})
  const [reviewIdx, setReviewIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [form, setForm] = useState({ subject: 'Biology', question: '', answer: '' })
  const [genForm, setGenForm] = useState({ subject: 'Biology', topic: '', count: 5 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => { api.getFlashcards().then(setCards).catch(() => {}) }, [])

  const dueCards = cards.filter(c => c.next_review <= Math.floor(Date.now() / 1000))
  const filteredCards = filter === 'All' ? cards : cards.filter(c => c.subject === filter)

  async function createCard(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const card = await api.createFlashcard(form)
      setCards(c => [card, ...c])
      setForm(f => ({ ...f, question: '', answer: '' }))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function generateCards(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await api.generateFlashcards(genForm)
      setCards(c => [...res.flashcards, ...c])
      setTab('browse')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function review(quality) {
    const card = dueCards[reviewIdx]
    await api.reviewFlashcard(card.id, quality)
    setCards(cs => cs.map(c => c.id === card.id ? { ...c, next_review: Date.now() / 1000 + 86400 } : c))
    setShowAnswer(false)
    setReviewIdx(i => i + 1)
  }

  async function deleteCard(id) {
    await api.deleteFlashcard(id)
    setCards(cs => cs.filter(c => c.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🃏 Flashcards</h1>
        <div className="flex gap-2">
          {[
            { key: 'browse', label: `Browse (${cards.length})` },
            { key: 'review', label: `Review (${dueCards.length})` },
            { key: 'create', label: 'Create' },
            { key: 'generate', label: '✨ AI Generate' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition
                ${tab === t.key ? 'bg-primary-500 text-white' : 'btn-secondary'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['All', ...SUBJECTS].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-sm px-3 py-1 rounded-full transition ${filter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {s}
              </button>
            ))}
          </div>
          {filteredCards.length === 0
            ? <p className="text-gray-400 text-center py-12">No flashcards yet. Create some or use AI generate!</p>
            : <div className="grid sm:grid-cols-2 gap-4">
                {filteredCards.map(c => (
                  <div key={c.id} className="card cursor-pointer hover:shadow-md transition" onClick={() => setFlipped(f => ({ ...f, [c.id]: !f[c.id] }))}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                        ${c.subject === 'Biology' ? 'bg-green-100 text-green-700' : c.subject === 'Chemistry' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {c.subject}
                      </span>
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-400">{flipped[c.id] ? 'Answer' : 'Question'}</span>
                        <button onClick={e => { e.stopPropagation(); deleteCard(c.id) }} className="text-gray-300 hover:text-red-500 transition text-xs">✕</button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                      {flipped[c.id] ? c.answer : c.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Click to {flipped[c.id] ? 'see question' : 'reveal answer'}</p>
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {tab === 'review' && (
        <div className="text-center">
          {dueCards.length === 0
            ? <div className="card py-16"><p className="text-4xl mb-3">🎉</p><p className="text-gray-600 dark:text-gray-300">All caught up! No cards due for review.</p></div>
            : reviewIdx >= dueCards.length
              ? <div className="card py-16"><p className="text-4xl mb-3">✅</p><p className="text-gray-600 dark:text-gray-300 font-semibold">Session complete! Great work.</p>
                  <button onClick={() => { setReviewIdx(0); setShowAnswer(false) }} className="btn-primary mt-4">Review Again</button></div>
              : <div className="card max-w-md mx-auto">
                  <div className="text-xs text-gray-400 mb-4">{reviewIdx + 1} / {dueCards.length}</div>
                  <div className="min-h-32 flex items-center justify-center mb-6">
                    <p className="text-lg text-gray-900 dark:text-white font-medium">
                      {showAnswer ? dueCards[reviewIdx].answer : dueCards[reviewIdx].question}
                    </p>
                  </div>
                  {!showAnswer
                    ? <button onClick={() => setShowAnswer(true)} className="btn-primary w-full">Show Answer</button>
                    : <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-3">How well did you know this?</p>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { q: 0, label: 'Forgot', color: 'bg-red-500' },
                            { q: 2, label: 'Hard', color: 'bg-orange-500' },
                            { q: 4, label: 'Good', color: 'bg-blue-500' },
                            { q: 5, label: 'Easy', color: 'bg-green-500' },
                          ].map(({ q, label, color }) => (
                            <button key={q} onClick={() => review(q)}
                              className={`${color} text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                  }
                </div>
          }
        </div>
      )}

      {tab === 'create' && (
        <div className="card max-w-md mx-auto">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Create Flashcard</h2>
          <form onSubmit={createCard} className="space-y-3">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Question</label>
              <textarea className="input resize-none" rows={3} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Answer</label>
              <textarea className="input resize-none" rows={3} value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Saving...' : 'Create Card'}</button>
          </form>
        </div>
      )}

      {tab === 'generate' && (
        <div className="card max-w-md mx-auto">
          <h2 className="font-bold text-gray-900 dark:text-white mb-2">✨ AI Flashcard Generator</h2>
          <p className="text-sm text-gray-500 mb-4">AI will create flashcards for your chosen topic.</p>
          <form onSubmit={generateCards} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={genForm.subject} onChange={e => setGenForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Count</label>
                <select className="input" value={genForm.count} onChange={e => setGenForm(f => ({ ...f, count: Number(e.target.value) }))}>
                  {[3,5,10].map(n => <option key={n} value={n}>{n} cards</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Topic</label>
              <input className="input" value={genForm.topic} onChange={e => setGenForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Cell Respiration" required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? '✨ Generating...' : '✨ Generate Flashcards'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
