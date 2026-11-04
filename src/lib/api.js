const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3002') + '/api'
const getToken = () => localStorage.getItem('sl_token')

async function req(path, options = {}, timeout = 300000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(BASE + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...options.headers,
      },
    })
    const data = await res.json()
    if (res.status === 401) {
      localStorage.removeItem('sl_token')
      localStorage.removeItem('sl_user')
      alert('Session expired — please log in again.')
      window.location.href = '/auth'
      return
    }
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const post = (path, body, timeout) => req(path, { method: 'POST', body: JSON.stringify(body) }, timeout)
const patch = (path, body) => req(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = (path) => req(path, { method: 'DELETE' })

export const api = {
  // Auth
  register: (d) => post('/auth/register', d),
  login: (d) => post('/auth/login', d),
  me: () => req('/auth/me'),
  updateProfile: (d) => patch('/auth/profile', d),
  // Dashboard
  dashboard: () => req('/dashboard'),
  leaderboard: () => req('/leaderboard'),
  // AI
  tutor: (d) => post('/ai/tutor', d),
  generateQuiz: (d) => post('/ai/quiz/generate', d),
  checkQuiz: (d) => post('/ai/quiz/check', d),
  // Flashcards
  getFlashcards: () => req('/flashcards'),
  createFlashcard: (d) => post('/flashcards', d),
  generateFlashcards: (d) => post('/flashcards/generate', d),
  reviewFlashcard: (id, quality) => patch(`/flashcards/${id}/review`, { quality }),
  deleteFlashcard: (id) => del(`/flashcards/${id}`),
  // Planner
  generatePlan: (d) => post('/planner/generate', d),
  getPlans: () => req('/planner'),
  // Sessions
  logSession: (d) => post('/sessions', d),
  // AI Usage
  aiUsage: () => req('/ai/usage'),
  // LARE
  getLareTopics: () => req('/lare'),
  createLareTopic: (d) => post('/lare', d),
  updateLareTopic: (id, d) => patch(`/lare/${id}`, d),
  deleteLareTopic: (id) => del(`/lare/${id}`),
  generateLareContent: (id) => post(`/lare/${id}/generate`, {}),
  recordLareQuiz: (id, d) => post(`/lare/${id}/quiz-result`, d),
  // Feedback
  submitFeedback: (text) => post('/feedback', { text }),
  // Notes
  getNotes: () => req('/notes'),
  createNote: (d) => post('/notes', d),
  updateNote: (id, d) => patch(`/notes/${id}`, d),
  deleteNote: (id) => del(`/notes/${id}`),
  // Grades
  getGrades: () => req('/grades'),
  scanGrades: (image, mimeType) => post('/grades/scan', { image, mimeType }),
  scanComments: (image, mimeType) => post('/grades/scan-comments', { image, mimeType }),
  addGrade: (d) => post('/grades', d),
  deleteGrade: (id) => del(`/grades/${id}`),
  // Language Learning
  getLangVocab: () => req('/lang/vocab'),
  generateVocab: (d) => post('/lang/vocab/generate', d),
  refreshVocab: (id) => post(`/lang/vocab/${id}/refresh`, {}),
  reviewVocab: (id, quality) => patch(`/lang/vocab/${id}/review`, { quality }),
  deleteVocab: (id) => del(`/lang/vocab/${id}`),
  langQuiz: (d) => post('/lang/quiz', d),
  langGrammar: (d) => post('/lang/grammar', d),
  langWriting: (d) => post('/lang/writing', d),
  langProgress: () => req('/lang/progress'),
  getRooms: () => req('/rooms'),
  createRoom: (d) => post('/rooms', d),
  deleteRoom: (id) => del(`/rooms/${id}`),
  joinRoom: (inviteCode) => post('/rooms/join', { inviteCode }),
  getMessages: (id) => req(`/rooms/${id}/messages`),
  getMembers: (id) => req(`/rooms/${id}/members`),
}
