import { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['Biology', 'Chemistry', 'Physics']
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

export default function Tutor() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm your AI Science Tutor 🤖\nAsk me anything about Biology, Chemistry, or Physics and I'll explain it clearly with examples!" }
  ])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('Biology')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    api.aiUsage().then(u => setRemaining(u.tutor?.remaining ?? null)).catch(() => {})
  }, [])

  async function ask(question) {
    if (!question.trim()) return
    setMessages(m => [...m, { role: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const res = await api.tutor({ question, subject, difficulty })
      setMessages(m => [...m, { role: 'ai', text: res.answer }])
      setRemaining(r => r !== null ? r - 1 : null)
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: `❌ ${err.message}`, error: true }])
    } finally { setLoading(false) }
  }

  function handleSubmit(e) { e.preventDefault(); ask(input) }

  const suggestions = [
    'Explain photosynthesis', 'What is mitosis?', 'How does DNA replication work?',
    'What is Newton\'s second law?', 'Explain chemical bonding', 'What is osmosis?'
  ]

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="label">Subject</label>
          <select className="input py-1.5" value={subject} onChange={e => setSubject(e.target.value)}>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Level</label>
          <select className="input py-1.5" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        {remaining !== null && (
          <div className={`ml-auto text-sm px-3 py-1.5 rounded-full font-medium
            ${remaining <= 3 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : remaining <= 8 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
            {remaining} / 20 asks left today
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="card flex-1 overflow-y-auto mb-4 space-y-4 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'ai' && (
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-1">🤖</div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed
              ${m.role === 'user'
                ? 'bg-primary-500 text-white rounded-br-sm'
                : m.error
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white">🤖</div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map(s => (
            <button key={s} onClick={() => ask(s)} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-3 py-1.5 rounded-full hover:bg-primary-100 transition">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="input flex-1"
          value={input} onChange={e => setInput(e.target.value)}
          placeholder={`Ask a ${subject} question...`}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-5">
          {loading ? '...' : '➤'}
        </button>
      </form>
    </div>
  )
}
