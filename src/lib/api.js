const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3002') + '/api'
const getToken = () => localStorage.getItem('sl_token')

async function req(path, options = {}, timeout = 60000) {
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

// AI requests get a longer timeout (90s)
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
  // AI
  tutor: (d) => post('/ai/tutor', d, 90000),
  generateQuiz: (d) => post('/ai/quiz/generate', d, 90000),
  checkQuiz: (d) => post('/ai/quiz/check', d, 90000),
  // Flashcards
  getFlashcards: () => req('/flashcards'),
  createFlashcard: (d) => post('/flashcards', d),
  generateFlashcards: (d) => post('/flashcards/generate', d, 90000),
  reviewFlashcard: (id, quality) => patch(`/flashcards/${id}/review`, { quality }),
  deleteFlashcard: (id) => del(`/flashcards/${id}`),
  // Planner
  generatePlan: (d) => post('/planner/generate', d, 90000),
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
  generateLareContent: (id) => post(`/lare/${id}/generate`, {}, 90000),
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
  addGrade: (d) => post('/grades', d),
  deleteGrade: (id) => del(`/grades/${id}`),
  // Rooms
  getRooms: () => req('/rooms'),
  createRoom: (d) => post('/rooms', d),
  deleteRoom: (id) => del(`/rooms/${id}`),
  joinRoom: (inviteCode) => post('/rooms/join', { inviteCode }),
  getMessages: (id) => req(`/rooms/${id}/messages`),
  getMembers: (id) => req(`/rooms/${id}/members`),
}
