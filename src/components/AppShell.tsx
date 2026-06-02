import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'
import MobileTopNav from './MobileTopNav'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* Mobile top nav — hidden on md+ */}
      <div className="mobile-only">
        <MobileTopNav onMenuToggle={() => setMobileMenuOpen(true)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="mobile-only" style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex' }}>
          {/* Backdrop */}
          <div
            className="sidebar-overlay"
            onClick={closeMobileMenu}
            style={{ position: 'absolute', inset: 0 }}
          />
          {/* Sidebar panel */}
          <div style={{ position: 'relative', zIndex: 50, flexShrink: 0 }}>
            <Sidebar onNavigate={closeMobileMenu} isOverlay />
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>

        {/* Desktop + tablet sidebar — hidden on mobile */}
        <div className="desktop-only">
          <Sidebar />
        </div>

        {/* Main content */}
        <main
          key={location.pathname}
          className="page-fade-in"
          style={{
            flex: 1,
            padding: 'clamp(16px, 4vw, 40px) clamp(16px, 4vw, 48px)',
            overflowY: 'auto',
            minWidth: 0,
          }}
        >
          {children}
        </main>

        {/* Right panel — hidden on mobile and tablet */}
        <div className="desktop-xl-only">
          <RightPanel />
        </div>

      </div>
    </div>
  )
}
