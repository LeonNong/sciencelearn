import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const TIER_COLORS = {
  1: { bg: '#fbbf24', text: '#78350f', label: 'Gold' },
  2: { bg: '#94a3b8', text: '#1e293b', label: 'Silver' },
  3: { bg: '#b45309', text: '#fff7ed', label: 'Bronze' },
}

function XPBar({ xp, level }) {
  const xpInLevel = xp % 100
  return (
    <div className="w-full bg-gray-800 h-1.5 mt-1">
      <div className="h-1.5 bg-primary-500 transition-all" style={{ width: `${xpInLevel}%` }} />
    </div>
  )
}

export default function Leaderboard() {
  const [board, setBoard] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('xp') // xp | streak | level
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.leaderboard().then(setBoard).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const sorted = [...board]
    .filter(u => u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[filter] - a[filter])
    .map((u, i) => ({ ...u, rank: i + 1 }))

  const me = board.find(u => u.isMe)
  const myRank = me ? sorted.findIndex(u => u.id === me.id) + 1 : null

  if (loading) return <p className="text-gray-500 text-xs text-center py-12">Loading...</p>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>Leaderboard</h1>
        {myRank && (
          <span className="text-xs px-3 py-1 border border-primary-700 text-primary-400">
            Your rank: #{myRank}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'xp',     label: 'XP' },
          { key: 'streak', label: 'Streak' },
          { key: 'level',  label: 'Level' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-xs px-4 py-1.5 border transition ${filter === f.key ? 'border-primary-500 text-primary-300 bg-primary-900/20' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
            {f.label}
          </button>
        ))}
        <input className="input py-1 text-xs flex-1 min-w-32" value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Search player..." />
      </div>

      {/* Top 3 podium */}
      {!search && sorted.length >= 3 && (
        <div className="flex items-end justify-center gap-3 pt-4 pb-2">
          {/* 2nd */}
          <div className="flex flex-col items-center gap-1 mb-2">
            <div className="w-12 h-12 flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: sorted[1].avatarColor, border: '3px solid #94a3b8' }}>
              {(sorted[1].displayName || sorted[1].username)[0].toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xs text-white truncate max-w-16">{sorted[1].displayName || sorted[1].username}</p>
              <p className="text-xs text-gray-500">{sorted[1][filter].toLocaleString()}</p>
            </div>
            <div className="w-16 flex items-center justify-center text-sm font-bold py-4" style={{ background: '#334155', border: '2px solid #94a3b8', color: '#94a3b8' }}>2</div>
          </div>
          {/* 1st */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xl">👑</p>
            <div className="w-16 h-16 flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: sorted[0].avatarColor, border: '3px solid #fbbf24' }}>
              {(sorted[0].displayName || sorted[0].username)[0].toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xs text-white truncate max-w-20">{sorted[0].displayName || sorted[0].username}</p>
              <p className="text-xs text-yellow-400">{sorted[0][filter].toLocaleString()}</p>
            </div>
            <div className="w-16 flex items-center justify-center text-sm font-bold py-6" style={{ background: '#451a03', border: '2px solid #fbbf24', color: '#fbbf24' }}>1</div>
          </div>
          {/* 3rd */}
          <div className="flex flex-col items-center gap-1 mb-4">
            <div className="w-12 h-12 flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: sorted[2].avatarColor, border: '3px solid #b45309' }}>
              {(sorted[2].displayName || sorted[2].username)[0].toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xs text-white truncate max-w-16">{sorted[2].displayName || sorted[2].username}</p>
              <p className="text-xs text-gray-500">{sorted[2][filter].toLocaleString()}</p>
            </div>
            <div className="w-16 flex items-center justify-center text-sm font-bold py-3" style={{ background: '#1c0a00', border: '2px solid #b45309', color: '#b45309' }}>3</div>
          </div>
        </div>
      )}

      {/* Full list */}
      <div className="space-y-1">
        {sorted.map((u, i) => {
          const tier = TIER_COLORS[u.rank]
          const isMe = u.isMe
          return (
            <div key={u.id}
              className={`flex items-center gap-3 px-4 py-3 transition ${isMe ? 'border border-primary-600 bg-primary-900/10' : 'border border-transparent hover:bg-gray-800/50'}`}>
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {tier ? (
                  <span className="text-sm font-bold" style={{ color: tier.bg }}>{u.rank}</span>
                ) : (
                  <span className="text-xs text-gray-600">{u.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-9 h-9 flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: u.avatarColor, border: tier ? `2px solid ${tier.bg}` : '2px solid transparent' }}>
                {(u.displayName || u.username)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${isMe ? 'text-primary-300' : 'text-white'}`}>
                    {u.displayName || u.username}
                    {isMe && <span className="text-xs text-primary-500 ml-1">(you)</span>}
                  </span>
                  {u.description && <span className="text-xs text-gray-600 truncate">{u.description}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Lv.{u.level}</span>
                  {u.streak > 0 && <span className="text-orange-400">{u.streak} day streak</span>}
                  {u.school && <span className="truncate max-w-24">{u.school}</span>}
                </div>
                <XPBar xp={u.xp} level={u.level} />
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold" style={{ color: tier ? tier.bg : '#e2e8f0' }}>
                  {u[filter].toLocaleString()}
                </p>
                <p className="text-xs text-gray-600">{filter === 'xp' ? 'XP' : filter === 'streak' ? 'days' : 'level'}</p>
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className="text-center text-gray-500 text-xs py-8">No players found.</p>
        )}
      </div>
    </div>
  )
}
