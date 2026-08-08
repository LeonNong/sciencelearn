import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Loader from './components/Loader'

const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Tutor = lazy(() => import('./pages/Tutor'))
const Quiz = lazy(() => import('./pages/Quiz'))
const Flashcards = lazy(() => import('./pages/Flashcards'))
const Planner = lazy(() => import('./pages/Planner'))
const Chat = lazy(() => import('./pages/Chat'))
const Scanner = lazy(() => import('./pages/Scanner'))
const LARE = lazy(() => import('./pages/LARE'))
const MemoryType = lazy(() => import('./pages/MemoryType'))
const Settings = lazy(() => import('./pages/Settings'))
const Notes = lazy(() => import('./pages/Notes'))
const Grades = lazy(() => import('./pages/Grades'))
const Comments = lazy(() => import('./pages/Comments'))
const Language = lazy(() => import('./pages/Language'))

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Loader /></div>
  return user ? children : <Navigate to="/auth" />
}

export default function App() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Loader /></div>}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" /> : <Auth />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="lare" element={<LARE />} />
          <Route path="tutor" element={<Tutor />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="planner" element={<Planner />} />
          <Route path="chat" element={<Chat />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="memory" element={<MemoryType />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notes" element={<Notes />} />
          <Route path="grades" element={<Grades />} />
          <Route path="comments" element={<Comments />} />
          <Route path="language" element={<Language />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

