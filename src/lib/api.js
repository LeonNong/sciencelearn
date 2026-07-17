const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3002') + '/api'
const getToken = () => localStorage.getItem('sl_token')

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const post = (path, body) => req(path, { method: 'POST', body: JSON.stringify(body) })
const patch = (path, body) => req(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = (path) => req(path, { method: 'DELETE' })

export const api = {
  // Auth
  register: (d) => post('/auth/register', d),
  login: (d) => post('/auth/login', d),
  me: () => req('/auth/me'),
  // Dashboard
  dashboard: () => req('/dashboard'),
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
  // Rooms
  getRooms: () => req('/rooms'),
  createRoom: (d) => post('/rooms', d),
  joinRoom: (inviteCode) => post('/rooms/join', { inviteCode }),
  getMessages: (id) => req(`/rooms/${id}/messages`),
  getMembers: (id) => req(`/rooms/${id}/members`),
}
