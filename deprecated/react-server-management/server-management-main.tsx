import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import M1ServerManagement from './pages/M1ServerManagement.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import './index.css'

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <AuthProvider>
      <M1ServerManagement />
    </AuthProvider>
  </StrictMode>,
)