import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar />
      <main key={location.pathname} className="page-fade-in" style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
      <RightPanel />
    </div>
  )
}
