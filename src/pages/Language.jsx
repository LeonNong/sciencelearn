import { useState } from 'react'
import VocabTab    from '../components/language/VocabTab'
import ReviewTab   from '../components/language/ReviewTab'
import QuizTab     from '../components/language/QuizTab'
import GrammarTab  from '../components/language/GrammarTab'
import WritingTab  from '../components/language/WritingTab'
import ProgressTab from '../components/language/ProgressTab'

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'French', 'Spanish', 'German', 'Mandarin', 'Portuguese']
const TABS = [
  { key: 'vocab',    label: 'Vocabulary' },
  { key: 'review',   label: 'Review' },
  { key: 'quiz',     label: 'Quiz' },
  { key: 'grammar',  label: 'Grammar' },
  { key: 'writing',  label: 'Writing' },
  { key: 'progress', label: 'Progress' },
]

export default function Language() {
  const [tab, setTab] = useState('vocab')
  const [lang, setLang] = useState('English')

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>Language Learning</h1>
        <select className="input w-auto py-1 text-sm" value={lang} onChange={e => setLang(e.target.value)}>
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1" style={{ borderBottom: '2px solid #3b82f6' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-2 text-xs font-medium transition"
            style={{
              color: tab === t.key ? '#e2e8f0' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #60a5fa' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vocab'    && <VocabTab lang={lang} />}
      {tab === 'review'   && <ReviewTab />}
      {tab === 'quiz'     && <QuizTab lang={lang} />}
      {tab === 'grammar'  && <GrammarTab lang={lang} />}
      {tab === 'writing'  && <WritingTab lang={lang} />}
      {tab === 'progress' && <ProgressTab />}
    </div>
  )
}
