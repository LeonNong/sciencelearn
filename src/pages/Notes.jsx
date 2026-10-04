import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['General', 'Biology', 'Chemistry', 'Physics', 'Mathematics',
  'Mathematical Literacy', 'English', 'Afrikaans', 'isiZulu', 'Life Orientation']

const SUBJECT_COLORS = {
  General: '#6b7280', Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', Afrikaans: '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

function formatDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function countWords(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function renderNoteContent(content) {
  if (!content?.trim()) {
    return <span className="text-gray-500 italic">Empty note - click Edit to start writing</span>
  }

  return content.split('\n').map((raw, i) => {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) return <div key={i} className="h-3" />

    if (trimmed.startsWith('### ')) {
      return <h4 key={i} className="mt-5 mb-2 text-sm font-bold text-primary-400">{trimmed.slice(4)}</h4>
    }
    if (trimmed.startsWith('## ')) {
      return <h3 key={i} className="mt-6 mb-3 text-base font-bold text-white border-b border-gray-700 pb-2">{trimmed.slice(3)}</h3>
    }
    if (trimmed.startsWith('# ')) {
      return <h2 key={i} className="mb-4 text-lg font-bold text-white">{trimmed.slice(2)}</h2>
    }
    if (/^[-*]\s+/.test(trimmed)) {
      return (
        <div key={i} className="flex gap-3 pl-2 text-gray-300">
          <span className="mt-0.5 text-primary-400">■</span>
          <span>{trimmed.replace(/^[-*]\s+/, '')}</span>
        </div>
      )
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const [, num, body] = trimmed.match(/^(\d+)\.\s+(.*)$/)
      return (
        <div key={i} className="flex gap-3 pl-2 text-gray-300">
          <span className="text-primary-400">{num}.</span>
          <span>{body}</span>
        </div>
      )
    }
    return <p key={i} className="text-gray-300 leading-7">{line}</p>
  })
}

function NoteCard({ note, onSelect, onPin, onDelete, selected }) {
  const color = SUBJECT_COLORS[note.subject] || '#6b7280'
  const words = countWords(note.content)
  return (
    <div onClick={() => onSelect(note)}
      className={`cursor-pointer border-2 bg-gray-900 p-3 transition-all hover:translate-x-0.5 hover:translate-y-0.5 ${selected ? 'border-primary-400 shadow-pixel-sm' : 'border-gray-700'}`}
      style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.pinned && <span className="text-xs">📌</span>}
            <h3 className="font-semibold text-white text-sm truncate">{note.title || 'Untitled note'}</h3>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 min-h-9">{note.content?.slice(0, 120) || 'Empty note'}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[9px] px-2 py-1 text-white uppercase" style={{ background: color }}>{note.subject}</span>
            <span className="text-[9px] text-gray-500">{formatDate(note.updated_at)}</span>
            <span className="text-[9px] text-gray-600">{words} words</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onPin(note)} title="Pin" className="text-gray-400 hover:text-yellow-500 transition text-sm">
            {note.pinned ? '📌' : '📍'}
          </button>
          <button onClick={() => onDelete(note.id)} title="Delete" className="text-gray-400 hover:text-red-500 transition text-sm">🗑</button>
        </div>
      </div>
    </div>
  )
}

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('All')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', content: '', subject: 'General' })
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => { api.getNotes().then(setNotes).catch(() => {}) }, [])

  const pinnedCount = notes.filter(n => n.pinned).length
  const totalWords = notes.reduce((sum, n) => sum + countWords(n.content), 0)
  const activeSubjects = ['All', ...SUBJECTS.filter(s => notes.some(n => n.subject === s))]

  const filtered = notes.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
    const matchSubject = filterSubject === 'All' || n.subject === filterSubject
    return matchSearch && matchSubject
  })

  function selectNote(note) {
    setSelected(note)
    setDraft({ title: note.title, content: note.content, subject: note.subject })
    setEditing(false)
    setCreating(false)
  }

  function startCreate() {
    setSelected(null)
    setDraft({ title: '', content: '', subject: 'General' })
    setCreating(true)
    setEditing(true)
  }

  async function saveNote() {
    setSaving(true)
    try {
      if (creating) {
        if (!draft.title.trim()) return
        const note = await api.createNote(draft)
        setNotes(prev => [note, ...prev])
        setSelected(note)
        setCreating(false)
      } else if (selected) {
        const updated = await api.updateNote(selected.id, draft)
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        setSelected(updated)
      }
      setEditing(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await api.deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function togglePin(note) {
    const updated = await api.updateNote(note.id, { pinned: !note.pinned })
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)))
    if (selected?.id === note.id) setSelected(updated)
  }

  // Auto-save while editing
  function handleContentChange(val) {
    setDraft(d => ({ ...d, content: val }))
    if (!creating && selected) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const updated = await api.updateNote(selected.id, { ...draft, content: val })
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      }, 1500)
    }
  }

  return (
    <div className="flex h-full gap-4" style={{ height: 'calc(100vh - 6rem)' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col border-2 border-primary-500 bg-gray-950 shadow-pixel">
        <div className="p-4 border-b-2 border-primary-500 bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-bold text-white">📓 Study Notes</h1>
              <p className="text-[9px] text-gray-500 mt-1">{notes.length} notes · {pinnedCount} pinned · {totalWords} words</p>
            </div>
            <button onClick={startCreate} className="btn-primary px-3 py-1.5 text-xs">+ New</button>
          </div>
          <input className="input text-sm py-2 mt-3" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {activeSubjects.map(s => (
              <button key={s} onClick={() => setFilterSubject(s)}
                className={`text-[9px] px-2 py-1 border transition ${filterSubject === s ? 'bg-primary-500 border-primary-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-primary-500'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filtered.length === 0
            ? (
              <div className="text-center py-10 px-4 border-2 border-dashed border-gray-700 bg-gray-900/50">
                <p className="text-3xl mb-3">📝</p>
                <p className="text-gray-400 text-xs leading-6">No notes found</p>
                <p className="text-gray-600 text-[9px] mt-2">Try a different subject or search term.</p>
              </div>
            )
            : filtered.map(n => (
                <NoteCard key={n.id} note={n} selected={selected?.id === n.id}
                  onSelect={selectNote} onPin={togglePin} onDelete={deleteNote} />
              ))
          }
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 border-2 border-gray-700 bg-gray-950 shadow-pixel">
        {selected || creating ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b-2 border-gray-700 bg-gray-900">
              {editing ? (
                <>
                  <input className="input flex-1 text-sm font-semibold" value={draft.title}
                    onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="Note title..." />
                  <select className="input py-1.5 text-sm w-44" value={draft.subject}
                    onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={saveNote} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
                    {saving ? '...' : '💾 Save'}
                  </button>
                  {!creating && <button onClick={() => setEditing(false)} className="btn-secondary px-3 py-1.5 text-sm">Cancel</button>}
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {selected?.pinned && <span className="text-xs">📌</span>}
                      <h2 className="font-bold text-white truncate">{selected?.title || 'Untitled note'}</h2>
                    </div>
                    <span className="text-[9px] text-gray-500">
                      {selected?.subject} · Updated {new Date(selected?.updated_at).toLocaleString()} · {countWords(selected?.content)} words
                    </span>
                  </div>
                  <button onClick={() => setEditing(true)} className="btn-secondary px-3 py-1.5 text-sm">✏️ Edit</button>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {editing ? (
                <textarea
                  className="w-full h-full min-h-96 bg-gray-900 border-2 border-gray-700 p-4 text-gray-200 text-sm leading-relaxed outline-none resize-none font-mono focus:border-primary-500"
                  value={draft.content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Start writing your notes here...&#10;&#10;Tip: Use ## for headings, - for bullet points"
                />
              ) : (
                <div className="mx-auto max-w-3xl border-l-4 border-primary-500 bg-gray-900 p-5 text-sm leading-relaxed shadow-pixel-sm">
                  <div className="space-y-1">
                    {renderNoteContent(selected?.content)}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 p-6">
            <div className="border-2 border-dashed border-gray-700 bg-gray-900 p-8 max-w-md">
              <p className="text-5xl mb-4">📓</p>
              <p className="font-semibold text-gray-300">Select a note or create a new one</p>
              <p className="text-[9px] text-gray-600 mt-3 leading-5">Use headings, bullets, and short sections to make Grade 11 revision easier to scan.</p>
              <button onClick={startCreate} className="btn-primary mt-4 px-6 py-2">+ New Note</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
