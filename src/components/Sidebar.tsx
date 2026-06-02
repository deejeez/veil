import { NavLink } from 'react-router-dom'

// ── Icons ─────────────────────────────────────────────────────────────────────

type IconName = 'home' | 'tasks' | 'vendors' | 'venue' | 'guests' | 'budget' | 'finances' | 'timeline' | 'settings'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  }
  switch (name) {
    // LayoutDashboard — 4 panels
    case 'home':
      return <svg {...p}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="3" y="15" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/></svg>
    // CheckSquare
    case 'tasks':
      return <svg {...p}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
    // Users
    case 'vendors':
      return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    // MapPin
    case 'venue':
      return <svg {...p}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    // UserPlus
    case 'guests':
      return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
    // Wallet
    case 'budget':
      return <svg {...p}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
    // TrendingUp
    case 'finances':
      return <svg {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    // CalendarClock
    case 'timeline':
      return <svg {...p}><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><circle cx="16" cy="16" r="6"/><path d="M16 14v2l1.5 1.5"/></svg>
    // SlidersHorizontal
    case 'settings':
      return <svg {...p}><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>
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

interface SidebarProps {
  onNavigate?: () => void
  isOverlay?: boolean
}

export default function Sidebar({ onNavigate, isOverlay }: SidebarProps) {
  return (
    <div
      className="sidebar-responsive"
      style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--color-sidebar)',
        boxShadow: isOverlay ? '4px 0 24px rgba(140,120,100,0.18)' : '2px 0 12px rgba(140,120,100,0.06)',
        padding: '32px 16px 24px',
        height: isOverlay ? '100vh' : '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: isOverlay ? 'relative' : 'sticky',
        top: 0,
        zIndex: isOverlay ? 50 : 10,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '0 10px', marginBottom: '32px' }}>
        <div className="sidebar-logo-icon" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Ring icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <p className="sidebar-logo-text" style={{
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
        <p className="sidebar-logo-text" style={{
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
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-nav-item${isActive ? ' active-nav' : ''}`}
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
              minHeight: '44px',
            })}
          >
            <Icon name={icon} />
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
