import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminLayout from './pages/AdminLayout'
import Dashboard from './pages/Dashboard'
import KnowledgeBases from './pages/KnowledgeBases'
import KnowledgeDetail from './pages/KnowledgeDetail'
import Systems from './pages/Systems'
import LLMConfig from './pages/LLMConfig'
import SearchConfig from './pages/SearchConfig'
import Stats from './pages/Stats'
import Users from './pages/Users'
import Logs from './pages/Logs'
import QAFrontend from './pages/QAFrontend'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/stats" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="knowledge" element={<KnowledgeBases />} />
        <Route path="knowledge/:id" element={<KnowledgeDetail />} />
        <Route path="systems" element={<Systems />} />
        <Route path="llm-config" element={<LLMConfig />} />
        <Route path="search-config" element={<SearchConfig />} />
        <Route path="stats" element={<Stats />} />
        <Route path="users" element={<Users />} />
        <Route path="logs" element={<Logs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/qa/:systemId" element={<QAFrontend />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
