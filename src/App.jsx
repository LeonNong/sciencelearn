import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Tutor from './pages/Tutor'
import Quiz from './pages/Quiz'
import Flashcards from './pages/Flashcards'
import Planner from './pages/Planner'
import Chat from './pages/Chat'
import Scanner from './pages/Scanner'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><div className="text-4xl animate-spin">🔬</div></div>
  return user ? children : <Navigate to="/auth" />
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" /> : <Auth />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="tutor" element={<Tutor />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="flashcards" element={<Flashcards />} />
        <Route path="planner" element={<Planner />} />
        <Route path="chat" element={<Chat />} />
        <Route path="scanner" element={<Scanner />} />
      </Route>
    </Routes>
  )
}
