import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

function Avatar({ name, color, size = 9 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
      style={{ backgroundColor: color }}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', isPublic: true })
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
    const socket = io(socketUrl, { auth: { token: localStorage.getItem('sl_token') } })
    socketRef.current = socket
    socket.on('new_message', msg => setMessages(m => [...m, msg]))
    api.getRooms().then(setRooms).catch(() => {})
    return () => socket.disconnect()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function selectRoom(room) {
    if (socketRef.current) {
      if (activeRoom) socketRef.current.emit('leave_room', activeRoom.id)
      socketRef.current.emit('join_room', room.id)
    }
    setActiveRoom(room); setShowSidebar(false)
    const [msgs, mems] = await Promise.all([api.getMessages(room.id), api.getMembers(room.id)])
    setMessages(msgs); setMembers(mems)
  }

  function sendMessage(e) {
    e.preventDefault()
    if (!content.trim() || !activeRoom) return
    socketRef.current.emit('send_message', { roomId: activeRoom.id, content, isAnonymous })
    setContent('')
  }

  async function createRoom(e) {
    e.preventDefault(); setError('')
    try {
      const room = await api.createRoom(form)
      setRooms(r => [room, ...r]); selectRoom(room)
      setShowCreate(false); setForm({ name: '', description: '', isPublic: true })
    } catch (err) { setError(err.message) }
  }

  async function joinRoom(e) {
    e.preventDefault(); setError('')
    try {
      const room = await api.joinRoom(inviteCode)
      setRooms(r => [room, ...r]); selectRoom(room)
      setShowJoin(false); setInviteCode('')
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="flex h-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" style={{ height: 'calc(100vh - 6rem)' }}>
      {/* Mobile overlay */}
      {showSidebar && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setShowSidebar(false)} />}

      {/* Rooms sidebar */}
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:static z-30 w-60 h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-transform duration-200`}>
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Study Rooms</p>
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }}
              className="flex-1 text-xs btn-primary py-1.5">+ New Room</button>
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }}
              className="flex-1 text-xs btn-secondary py-1.5">Join</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {rooms.map(r => (
            <button key={r.id} onClick={() => selectRoom(r)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition
                ${activeRoom?.id === r.id ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span className="text-gray-400">#</span>
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Avatar name={user?.username} color={user?.avatarColor} size={7} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user?.username}</p>
              <p className="text-xs text-gray-400">Lv.{user?.level}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="h-12 px-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button className="md:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white" onClick={() => setShowSidebar(true)}>☰</button>
          <span className="text-gray-400">#</span>
          <span className="font-semibold text-gray-900 dark:text-white truncate">{activeRoom?.name || 'Select a room'}</span>
          {user?.isAdmin && <span className="ml-auto bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">Admin</span>}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {!activeRoom && (
            <div className="flex items-center justify-center h-full text-center text-gray-400">
              <div><p className="text-4xl mb-2">💬</p><p>Select or create a study room</p></div>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            const compact = prev && prev.username === m.username && (m.created_at - prev.created_at) < 300
            return (
              <div key={m.id} className={`flex gap-3 px-2 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group ${compact ? '' : 'mt-3'}`}>
                {compact
                  ? <div className="w-9 flex-shrink-0 flex items-end justify-center pb-0.5">
                      <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100">{formatTime(m.created_at)}</span>
                    </div>
                  : <Avatar name={m.username} color={m.avatar_color} size={9} />}
                <div className="flex-1 min-w-0">
                  {!compact && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${m.is_anonymous ? 'text-gray-400 italic' : 'text-gray-900 dark:text-white'}`}>
                        {m.username}
                        {m.is_anonymous && user?.isAdmin && <span className="ml-1 text-xs text-primary-500 font-normal">(anonymous)</span>}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(m.created_at)}</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">{m.content}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {activeRoom && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={sendMessage} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
              <input
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400"
                value={content} onChange={e => setContent(e.target.value)}
                placeholder={isAnonymous ? `Message anonymously...` : `Message #${activeRoom.name}`}
              />
              <button type="button" onClick={() => setIsAnonymous(v => !v)} title="Toggle anonymous"
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex-shrink-0
                  ${isAnonymous ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                🥷 {isAnonymous ? 'Anon' : ''}
              </button>
              <button type="submit" disabled={!content.trim()} className="text-primary-500 hover:text-primary-700 disabled:opacity-30 transition text-lg">➤</button>
            </form>
            {isAnonymous && <p className="text-xs text-gray-400 mt-1 px-1">🔒 Only admins can see your identity</p>}
          </div>
        )}
      </div>

      {/* Members panel */}
      {activeRoom && members.length > 0 && (
        <div className="w-44 border-l border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide p-3 pb-2">Members — {members.length}</p>
          <div className="px-2 space-y-0.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: m.avatar_color }}>
                  {m.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{m.username}</p>
                  <p className="text-xs text-gray-400">Lv.{m.level}</p>
                </div>
                {m.is_admin && <span className="ml-auto text-xs">👑</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {(showCreate || showJoin) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">{showCreate ? 'Create Room' : 'Join Room'}</h2>
            {showCreate ? (
              <form onSubmit={createRoom} className="space-y-3">
                <div><label className="label">Room Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} className="accent-primary-500" />
                  Public room
                </label>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create</button></div>
              </form>
            ) : (
              <form onSubmit={joinRoom} className="space-y-3">
                <div><label className="label">Invite Code</label><input className="input uppercase" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required /></div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowJoin(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Join</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
