import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const SUBJECTS = ['General', 'Biology', 'Chemistry', 'Physics', 'Mathematics',
  'Mathematical Literacy', 'English', 'Afrikaans', 'isiZulu', 'Life Orientation']

const SUBJECT_COLORS = {
  General: '#6b7280', Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', Afrikaans: '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

function NoteCard({ note, onSelect, onPin, onDelete, selected }) {
  const color = SUBJECT_COLORS[note.subject] || '#6b7280'
  return (
    <div onClick={() => onSelect(note)}
      className={`card cursor-pointer hover:shadow-md transition-all border-l-4 ${selected ? 'ring-2 ring-primary-500' : ''}`}
      style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.pinned && <span className="text-xs">📌</span>}
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{note.title}</h3>
          </div>
          <p className="text-xs text-gray-500 truncate">{note.content?.slice(0, 80) || 'Empty note'}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{note.subject}</span>
            <span className="text-xs text-gray-400">{new Date(note.updated_at).toLocaleDateString()}</span>
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
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n).sort((a, b) => b.pinned - a.pinned))
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
    <div className="flex h-full gap-0" style={{ height: 'calc(100vh - 6rem)' }}>
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-bold text-gray-900 dark:text-white">📓 Notes</h1>
            <button onClick={startCreate} className="btn-primary px-3 py-1.5 text-xs">+ New</button>
          </div>
          <input className="input text-sm py-1.5" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-1 mt-2 flex-wrap">
            {['All', ...SUBJECTS.slice(0, 5)].map(s => (
              <button key={s} onClick={() => setFilterSubject(s)}
                className={`text-xs px-2 py-0.5 rounded-full transition ${filterSubject === s ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filtered.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">No notes yet</p>
            : filtered.map(n => (
                <NoteCard key={n.id} note={n} selected={selected?.id === n.id}
                  onSelect={selectNote} onPin={togglePin} onDelete={deleteNote} />
              ))
          }
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected || creating ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
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
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-900 dark:text-white">{selected?.title}</h2>
                    <span className="text-xs text-gray-500">{selected?.subject} · Updated {new Date(selected?.updated_at).toLocaleString()}</span>
                  </div>
                  <button onClick={() => setEditing(true)} className="btn-secondary px-3 py-1.5 text-sm">✏️ Edit</button>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {editing ? (
                <textarea
                  className="w-full h-full min-h-96 bg-transparent text-gray-800 dark:text-gray-200 text-sm leading-relaxed outline-none resize-none font-mono"
                  value={draft.content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Start writing your notes here...&#10;&#10;Tip: Use ## for headings, - for bullet points"
                />
              ) : (
                <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selected?.content || <span className="text-gray-400 italic">Empty note — click Edit to start writing</span>}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400">
            <div>
              <p className="text-5xl mb-4">📓</p>
              <p className="font-semibold text-gray-600 dark:text-gray-300">Select a note or create a new one</p>
              <button onClick={startCreate} className="btn-primary mt-4 px-6 py-2">+ New Note</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
