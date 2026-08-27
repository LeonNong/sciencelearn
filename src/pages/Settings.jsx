import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

const AVATAR_COLORS = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B',
  '#EF4444','#EC4899','#06B6D4','#84CC16',
  '#F97316','#6366F1','#14B8A6','#A855F7',
]

const HOME_LANGUAGES = ['English', 'Chinese', 'Afrikaans', 'isiZulu', 'French', 'Spanish', 'Portuguese', 'German']

export default function Settings() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    school: user?.school || '',
    grade: user?.grade || '',
    avatarColor: user?.avatarColor || '#3B82F6',
  })
  const [homeLang, setHomeLang] = useState(() => localStorage.getItem('sl_home_lang') || 'English')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const updated = await api.updateProfile(form)
      updateUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ Settings</h1>

      {/* Avatar preview */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
          style={{ backgroundColor: form.avatarColor, border: '3px solid', borderColor: form.avatarColor, boxShadow: `4px 4px 0 #0008` }}>
          {(form.displayName || user?.username || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{form.displayName || user?.username}</p>
          {form.school && <p className="text-xs text-gray-400 mt-0.5">{form.school}{form.grade ? ` · ${form.grade}` : ''}</p>}
          <p className="text-xs text-gray-400">@{user?.username} · Lv.{user?.level}</p>
        </div>
      </div>

      <form onSubmit={save} className="card space-y-5">
        {/* Display name */}
        <div>
          <label className="label">Display Name</label>
          <input className="input" value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            placeholder={user?.username} maxLength={30} />
          <p className="text-xs text-gray-400 mt-1">Shown in chat and profile. Username stays unchanged.</p>
        </div>

        {/* School */}
        <div>
          <label className="label">School</label>
          <input className="input" value={form.school}
            onChange={e => set('school', e.target.value)}
            placeholder="Your school name" maxLength={60} />
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.grade}
            onChange={e => set('grade', e.target.value)}
            placeholder="e.g. Grade 10, Science lover..." maxLength={14} />
          <p className="text-xs text-gray-400 mt-1">{form.grade.length}/14</p>
        </div>

        {/* Home language */}
        <div>
          <label className="label">Home Language</label>
          <select className="input" value={homeLang} onChange={e => { setHomeLang(e.target.value); localStorage.setItem('sl_home_lang', e.target.value) }}>
            {HOME_LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Used in Language Learning writing feedback.</p>
        </div>

        {/* Avatar color */}
        <div>
          <label className="label">Avatar Color</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_COLORS.map(c => (
              <button type="button" key={c} onClick={() => set('avatarColor', c)}
                style={{ backgroundColor: c, width: 32, height: 32, border: form.avatarColor === c ? '3px solid white' : '3px solid transparent', boxShadow: form.avatarColor === c ? '0 0 0 2px ' + c : 'none' }} />
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
