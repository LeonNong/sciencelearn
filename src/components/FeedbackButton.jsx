import { useState } from 'react'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    // Store locally or send to a mailto / endpoint
    const existing = JSON.parse(localStorage.getItem('lw_feedback') || '[]')
    existing.push({ text, ts: new Date().toISOString() })
    localStorage.setItem('lw_feedback', JSON.stringify(existing))
    setSent(true)
    setTimeout(() => { setOpen(false); setSent(false); setText('') }, 1800)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg transition hover:scale-105 active:scale-95"
      >
        💡 <span>Want a new feature? Feedback now!</span>
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
                  <button type="submit" disabled={!text.trim()} className="btn-primary w-full py-2.5">
                    Send Feedback
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
