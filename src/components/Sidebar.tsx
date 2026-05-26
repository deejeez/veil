import { NavLink } from 'react-router-dom'
import AiAdvisorCard from './AiAdvisorCard'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/todos', label: 'Tasks' },
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
        width: '220px',
        flexShrink: 0,
        background: 'var(--color-sidebar)',
        padding: '28px 20px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: '36px' }}>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '22px',
            letterSpacing: '0.08em',
            color: 'var(--color-accent)',
            margin: '0 0 4px 0',
            lineHeight: 1.2,
          }}
        >
          Veil
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(196,120,138,0.5)',
          margin: 0,
        }}>
          Your wedding planner
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'block',
              fontSize: '14px',
              color: isActive ? 'var(--color-sidebar-active)' : 'var(--color-sidebar-text)',
              padding: '9px 14px',
              marginBottom: '2px',
              borderRadius: '10px',
              background: isActive ? 'rgba(196,120,138,0.18)' : 'transparent',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.01em',
              transition: 'background 0.12s',
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
