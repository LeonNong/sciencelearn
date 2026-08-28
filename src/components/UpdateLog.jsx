const UPDATES = [
  { date: '2026-08-29', tag: 'NEW', color: '#10b981', items: [
    'AI Tutor — added “Just Chat” subject (default), grade selector (Grade 7–12) replaces difficulty level',
    'AI Tutor — Froggy awake avatar background now matches page (transparent)',
    'AI Tutor — fixed message text color for dark theme',
    'Language — # prefix replaces /home for home-language word translation',
  ]},
  { date: '2026-08-28', tag: 'NEW', color: '#10b981', items: ['Leaderboard — XP / Streak / Level ranking with podium and search'] },
  { date: '2026-08-28', tag: 'NEW', color: '#10b981', items: ['Dashboard — Update Log', 'Settings — Home Language preference, Description field (replaces Year/Grade)'] },
  { date: '2026-08-27', tag: 'NEW', color: '#10b981', items: [
    'Language Learning — Vocabulary flashcards (flip, multi-meaning, pos abbr, Afrikaans v1/v2/tense, AI refresh all)',
    'Writing — AI detects AI-generated content, highlights native language words, one-click add to vocab',
    'Review — 百词斜 style multiple choice with streak counter',
    'Adaptive Quiz, Grammar Practice, Progress stats',
  ]},
  { date: '2026-08-27', tag: 'FIX', color: '#3b82f6', items: ['Grade Tracker — bulk year setter in AI scan modal', 'Year filter with All Years default'] },
  { date: '2026-08-26', tag: 'NEW', color: '#10b981', items: [
    'Grade Tracker — import from ADAM HTML file, PDF scan support',
    'Grade Tracker — collapsible subject groups, clear all, teacher comments',
    'Grade Tracker — line chart on Dashboard',
    'Comments page — scan report card for teacher remarks',
    'Register — confirm password field',
  ]},
  { date: '2026-08-25', tag: 'NEW', color: '#10b981', items: ['Notes page — create, edit, pin, search, auto-save'] },
  { date: '2026-08-25', tag: 'FIX', color: '#3b82f6', items: ['Flashcard badge colors and quiz text contrast for dark theme', 'AI structured responses, calendar view in Planner'] },
  { date: '2026-08-24', tag: 'NEW', color: '#10b981', items: [
    'Settings page — display name, school, grade, avatar color',
    'Pixel art UI — font, borders, colors, sidebar, pixel frog logo',
    'Memory Typing game — 3 difficulty levels',
    'Floating feedback button',
    'LARE engine — adaptive learning priority ranking',
  ]},
  { date: '2026-08-23', tag: 'NEW', color: '#10b981', items: [
    'AI rate limiting with daily usage display',
    'Switched AI from Gemini to OpenAI GPT-4o',
    'Chat rooms — delete room for owner/admin',
    'Lazy loading + Render keep-alive ping',
  ]},
  { date: '2026-08-22', tag: 'NEW', color: '#10b981', items: ['Initial launch — AI Tutor, Quiz, Flashcards, Study Planner, OCR Scanner, Chat Rooms'] },
]

export default function UpdateLog() {
  return (
    <div className="card">
      <h2 className="font-bold text-white mb-4">📋 Update Log</h2>
      <div className="space-y-3">
        {UPDATES.map((entry, i) => (
          <div key={i} className="flex gap-3 text-xs">
            <div className="flex-shrink-0 w-20 text-gray-600">{entry.date}</div>
            <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-bold h-fit"
              style={{ background: entry.color + '20', color: entry.color, border: `1px solid ${entry.color}40` }}>
              {entry.tag}
            </span>
            <ul className="space-y-1">
              {entry.items.map((item, j) => (
                <li key={j} className="text-gray-400">— {item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
