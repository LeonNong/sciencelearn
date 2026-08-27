import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

export default function WritingTab({ lang }) {
  const [nativeLang] = useState(() => localStorage.getItem('sl_home_lang') || 'English')
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState({})
  const [existingVocab, setExistingVocab] = useState([])
  const [addingAll, setAddingAll] = useState(false)

  useEffect(() => {
    api.getLangVocab().then(setExistingVocab).catch(() => {})
  }, [])

  function isInVocab(translation) {
    return existingVocab.some(v =>
      v.word.toLowerCase() === translation.toLowerCase() && v.language === lang
    )
  }

  async function analyse() {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null); setAdded({})
    try {
      const res = await api.langWriting({ language: lang, nativeLanguage: nativeLang, prompt, text })
      setResult(res)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addToVocab(word) {
    if (isInVocab(word.translation) || added[word.original]) return
    try {
      const entry = await api.generateVocab({ word: word.translation, language: lang })
      setAdded(a => ({ ...a, [word.original]: true }))
      setExistingVocab(v => [...v, entry])
    } catch (err) { setError('Failed to add: ' + err.message) }
  }

  async function addAllToVocab() {
    if (!result?.native_words?.length) return
    setAddingAll(true)
    const toAdd = result.native_words.filter(w => !isInVocab(w.translation) && !added[w.original])
    for (const w of toAdd) {
      try {
        const entry = await api.generateVocab({ word: w.translation, language: lang })
        setAdded(a => ({ ...a, [w.original]: true }))
        setExistingVocab(v => [...v, entry])
      } catch {}
    }
    setAddingAll(false)
  }

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
          <select className="input text-xs" value={lang} disabled><option>{lang}</option></select>
        </div>
        <div className="flex-1">
          <label className="label">Home language</label>
          <select className="input text-xs" value={nativeLang} disabled><option>{nativeLang}</option></select>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Change in Settings</p>
        </div>
      </div>

      <div className="card border border-primary-900/50" style={{ background: '#0f172a' }}>
        <p className="text-primary-400 text-xs mb-2">Tip: Write in {lang}. For words you don't know, just write them in {nativeLang} ¡ª AI will translate and highlight them for you to learn.</p>
      </div>

      <div>
        <label className="label">Topic (optional ¡ª leave blank to free write)</label>
        <input className="input text-xs" value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. My daily routine, A memorable trip, My favourite food..." />
      </div>

      <div>
        <label className="label">Your writing</label>
        <textarea className="input resize-none text-xs" rows={6} value={text}
          onChange={e => { setText(e.target.value); setResult(null) }}
          placeholder={`Mix ${lang} and ${nativeLang} ¡ª e.g. "I love to ÅÜ²½ every morning..."`} />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={analyse} disabled={loading || !text.trim()} className="btn-primary w-full">
        {loading ? 'Analysing...' : 'Analyse Writing'}
      </button>

      {result && (
        <div className="space-y-4">
          {result.ai_score > 60 && (
            <div className="card border border-orange-800" style={{ background: '#1c1008' }}>
              <p className="text-orange-400 text-xs font-bold mb-1">AI Content Detected ({result.ai_score}%)</p>
              <p className="text-orange-300 text-xs">{result.ai_warning}</p>
              <p className="text-gray-500 text-xs mt-1">Try writing more naturally in your own voice.</p>
            </div>
          )}

          <div className="card">
            <p className="text-gray-400 text-xs mb-2 font-bold">Your text with highlights:</p>
            <p className="text-xs leading-relaxed">{renderHighlighted()}</p>
          </div>

          {result.native_words?.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-yellow-400 text-xs font-bold">
                  {result.native_words.length} word{result.native_words.length !== 1 ? 's' : ''} to learn:
                </p>
                {result.native_words.some(w => !isInVocab(w.translation) && !added[w.original]) && (
                  <button onClick={addAllToVocab} disabled={addingAll} className="btn-primary text-xs px-3 py-1">
                    {addingAll ? 'Adding...' : '+ Add All'}
                  </button>
                )}
              </div>
              {result.native_words.map((w, i) => {
                const alreadyHas = isInVocab(w.translation)
                const justAdded = added[w.original]
                return (
                  <div key={i} className="flex items-start gap-3 p-2 border border-gray-700">
                    <div className="flex-1">
                      <span className="text-yellow-300 text-xs font-bold">{w.original}</span>
                      <span className="text-gray-500 text-xs mx-2">¡ú</span>
                      <span className="text-green-400 text-xs font-bold">{w.translation}</span>
                      {alreadyHas && <span className="text-xs ml-2" style={{ color: '#4b5563' }}>already in vocab</span>}
                      <p className="text-gray-400 text-xs mt-0.5">{w.definition}</p>
                      {w.example && <p className="text-gray-600 text-xs italic">"{w.example}"</p>}
                    </div>
                    {!alreadyHas && (
                      <button onClick={() => addToVocab(w)} disabled={justAdded}
                        className={`text-xs px-2 py-1 shrink-0 transition ${justAdded ? 'text-green-500 border border-green-800' : 'btn-primary'}`}>
                        {justAdded ? 'Added' : '+ Vocab'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

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
