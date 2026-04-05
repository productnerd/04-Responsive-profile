import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Create from './pages/Create'
import Questionnaire from './pages/Questionnaire'
import Done from './pages/Done'
import Results from './pages/Results'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<Create />} />
        <Route path="/s/:slug" element={<Questionnaire />} />
        <Route path="/s/:slug/done" element={<Done />} />
        <Route path="/results/:slug" element={<Results />} />
        {/* Short-form alias for results links (accepts /r/:slug) */}
        <Route path="/r/:slug" element={<ResultsAlias />} />
        {/* Catch-all: never render a blank page on a bad URL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

// Preserves the slug param when redirecting /r/:slug → /results/:slug
import { useParams } from 'react-router-dom'
function ResultsAlias() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/results/${slug}`} replace />
}
