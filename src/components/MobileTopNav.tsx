import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface MobileTopNavProps {
  onMenuToggle: () => void
}

export default function MobileTopNav({ onMenuToggle }: MobileTopNavProps) {
  const [coupleName, setCoupleName] = useState<string>('')

  useEffect(() => {
    async function fetchCouple() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('couples')
        .select('name_primary, name_partner')
        .or(`user_id_primary.eq.${user.id},user_id_partner.eq.${user.id}`)
        .maybeSingle()
      // Show the primary name on its own when there's no partner name yet,
      // matching how Dashboard and RightPanel render the couple line.
      if (data?.name_primary) {
        setCoupleName(
          data.name_partner
            ? `${data.name_primary} & ${data.name_partner}`
            : data.name_primary
        )
      }
    }
    fetchCouple()
  }, [])

  return (
    <div className="mobile-top-nav">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '18px',
          color: 'var(--color-text-primary)',
          letterSpacing: '0.04em',
        }}>
          Veil
        </span>
      </div>

      {/* Couple names */}
      {coupleName && (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.02em',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '160px',
        }}>
          {coupleName}
        </span>
      )}

      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          minWidth: '44px',
          minHeight: '44px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Open navigation menu"
      >
        <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-text-secondary)', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-text-secondary)', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-text-secondary)', borderRadius: '1px' }} />
      </button>
    </div>
  )
}
