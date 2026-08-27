import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

export default function ProgressTab() {
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
