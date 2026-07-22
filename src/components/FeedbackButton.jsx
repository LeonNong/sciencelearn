import { useState } from 'react'
import { api } from '../lib/api'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      await api.submitFeedback(text)
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false); setText('') }, 1800)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 group"
        title="Want a new feature? Feedback now!"
      >
        <span>💡</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm">
          Feedback
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            {sent ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-bold text-gray-900 dark:text-white">Thanks for your feedback!</p>
                <p className="text-sm text-gray-500 mt-1">We'll consider it for the next update.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">💡 Want a new feature?</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Tell us what you'd love to see in LearnWay!</p>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none ml-4">×</button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                  <textarea
                    className="input resize-none w-full"
                    rows={4}
                    placeholder="e.g. I'd love a dark mode toggle, leaderboard, offline mode..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    autoFocus
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={!text.trim() || loading} className="btn-primary w-full py-2.5">
                    {loading ? 'Sending...' : 'Send Feedback'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
