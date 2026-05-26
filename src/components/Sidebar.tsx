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
        width: '148px',
        flexShrink: 0,
        background: 'var(--color-sidebar)',
        padding: '18px 14px',
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
          fontSize: '12px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          marginBottom: '24px',
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
              fontSize: '11px',
              color: isActive ? 'var(--color-sidebar-active)' : 'var(--color-sidebar-text)',
              padding: isActive ? '6px 6px 6px 6px' : '6px 8px',
              marginBottom: '2px',
              borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: isActive ? 'rgba(200,169,110,0.15)' : 'transparent',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.02em',
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
