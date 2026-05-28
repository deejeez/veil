import { NavLink } from 'react-router-dom'

// ── Icons ─────────────────────────────────────────────────────────────────────

type IconName = 'home' | 'tasks' | 'vendors' | 'venue' | 'guests' | 'budget' | 'finances' | 'timeline' | 'settings'

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  }
  switch (name) {
    case 'home':
      return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'tasks':
      return <svg {...p}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    case 'vendors':
      return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    case 'venue':
      return <svg {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    case 'budget':
      return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    case 'finances':
      return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    case 'timeline':
      return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    case 'guests':
      return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    case 'settings':
      return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    default: return null
  }
}

// ── Nav config ────────────────────────────────────────────────────────────────

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: '/',          label: 'Home',      icon: 'home' },
  { to: '/todos',     label: 'Tasks',     icon: 'tasks' },
  { to: '/vendors',   label: 'Vendors',   icon: 'vendors' },
  { to: '/venue',     label: 'Venue',     icon: 'venue' },
  { to: '/guests',    label: 'Guests',    icon: 'guests' },
  { to: '/budget',    label: 'Budget',    icon: 'budget' },
  { to: '/finances',  label: 'Finances',  icon: 'finances' },
  { to: '/timeline',  label: 'Timeline',  icon: 'timeline' },
  { to: '/settings',  label: 'Settings',  icon: 'settings' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  return (
    <div
      style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--color-sidebar)',
        boxShadow: '2px 0 12px rgba(140,120,100,0.06)',
        padding: '32px 16px 24px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '0 10px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Ring icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <p style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '20px',
            letterSpacing: '0.06em',
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1,
          }}>
            Veil
          </p>
        </div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          margin: '5px 0 0 30px',
        }}>
          Wedding Planner
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13.5px',
              color: isActive ? 'var(--color-accent)' : 'var(--color-sidebar-text)',
              padding: '9px 12px 9px 9px',
              borderRadius: '0 8px 8px 0',
              background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: isActive ? 600 : 400,
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            })}
          >
            <Icon name={icon} />
            {label}
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
