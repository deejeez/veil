import { NavLink } from 'react-router-dom'
import AiAdvisorCard from './AiAdvisorCard'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/budget', label: 'Budget' },
  { to: '/finances', label: 'Finances' },
  { to: '/timeline', label: 'Timeline' },
]

interface SidebarProps {
  latestInsight?: string | null
}

export default function Sidebar({ latestInsight }: SidebarProps) {
  return (
    <div
      style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--color-sidebar)',
        padding: '24px 16px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '15px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          marginBottom: '32px',
          lineHeight: 1.4,
        }}
      >
        Veil
      </p>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'block',
              fontSize: '13px',
              color: isActive ? 'var(--color-sidebar-active)' : 'var(--color-sidebar-text)',
              padding: '8px 12px',
              marginBottom: '4px',
              borderRadius: '8px',
              background: isActive ? 'rgba(200,169,110,0.18)' : 'transparent',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.01em',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <AiAdvisorCard text={latestInsight ?? null} />
    </div>
  )
}
