import { type ReactNode } from 'react'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
      <RightPanel />
    </div>
  )
}
