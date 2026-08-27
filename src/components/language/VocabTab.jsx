import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { parseMeanings } from './parseMeanings'

export default function VocabTab({ lang }) {
  const [vocab, setVocab] = useState([])
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flipped, setFlipped] = useState({})
  const [refreshing, setRefreshing] = useState({})
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState(0)

  useEffect(() => { api.getLangVocab().then(setVocab).catch(() => {}) }, [])

  async function addWord(e) {
    e.preventDefault()
    if (!word.trim()) return
    setLoading(true); setError('')
    try {
      let targetWord = word.trim()
      // /home prefix: translate from home language to target language first
      if (targetWord.toLowerCase().startsWith('/home ')) {
        const homeWord = targetWord.slice(6).trim()
        if (!homeWord) { setError('Enter a word after /home'); setLoading(false); return }
        const homeLang = localStorage.getItem('sl_home_lang') || 'English'
        const res = await api.generateVocab({ word: homeWord, language: lang, translateFrom: homeLang })
        setVocab(v => [res, ...v])
        setWord('')
        return
      }
      const entry = await api.generateVocab({ word: targetWord, language: lang })
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

  async function refreshAll() {
    setRefreshingAll(true)
    setRefreshProgress(0)
    setError('')
    for (let i = 0; i < vocab.length; i++) {
      try {
        const updated = await api.refreshVocab(vocab[i].id)
        setVocab(v => v.map(x => x.id === vocab[i].id ? updated : x))
        setFlipped(f => ({ ...f, [vocab[i].id]: false }))
      } catch {}
      setRefreshProgress(i + 1)
    }
    setRefreshingAll(false)
  }

  function flip(id) { setFlipped(f => ({ ...f, [id]: !f[id] })) }

  return (
    <div className="space-y-4">
      <form onSubmit={addWord} className="flex gap-2">
        <input className="input flex-1" value={word} onChange={e => setWord(e.target.value)}
          placeholder={`${lang} word, or /home watch to translate from home language`} />
        <button type="submit" disabled={loading} className="btn-primary px-4">
          {loading ? '...' : '+ Add'}
        </button>
        {vocab.length > 0 && (
          <button type="button" onClick={refreshAll} disabled={refreshingAll}
            className="btn-secondary px-3 text-xs" title="Refresh all with AI">
            {refreshingAll ? `${refreshProgress}/${vocab.length}` : 'AI All'}
          </button>
        )}
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
