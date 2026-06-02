import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser } from '../../lib/couple'
import { upsertVendor } from '../../lib/vendors'

const VENDOR_TILES = [
  { category: 'venue',          emoji: '🏛️',  label: 'Venue' },
  { category: 'photographer',   emoji: '📷',  label: 'Photographer' },
  { category: 'videographer',   emoji: '🎬',  label: 'Videographer' },
  { category: 'caterer',        emoji: '🍽️',  label: 'Caterer' },
  { category: 'florist',        emoji: '💐',  label: 'Florist' },
  { category: 'band_dj',        emoji: '🎶',  label: 'DJ / Band' },
  { category: 'wedding_planner',emoji: '📋',  label: 'Wedding Planner' },
  { category: 'officiant',      emoji: '💍',  label: 'Officiant' },
] as const

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '40px' }}>
      {[1, 2, 3].map(n => (
        <div
          key={n}
          style={{
            height: '3px',
            flex: 1,
            borderRadius: '2px',
            background: n <= current ? 'var(--color-accent)' : 'var(--color-border)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  )
}

export default function OnboardingStep2() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
    }
    load()
  }, [])

  function toggle(category: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  async function handleNext() {
    if (!coupleId || saving) return
    setSaving(true)
    try {
      // Create booked vendor records for selected tiles
      const selectedCategories = Array.from(selected)
      await Promise.all(
        selectedCategories.map(category => {
          const tile = VENDOR_TILES.find(t => t.category === category)
          return upsertVendor({
            couple_id: coupleId,
            category,
            name: tile?.label ?? null,
            status: 'booked',
          })
        })
      )
      // Store selected categories in localStorage for dashboard cold-start
      localStorage.setItem('veil_onboarding_booked', JSON.stringify(selectedCategories))
      navigate('/onboarding/3')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    localStorage.setItem('veil_onboarding_booked', JSON.stringify([]))
    navigate('/onboarding/3')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      {/* Logo */}
      <div style={{ position: 'fixed', top: 24, left: 28 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-accent)', letterSpacing: '0.02em' }}>
          Veil
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: '520px' }}>
        <StepIndicator current={2} />

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
          Step 2 of 3
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.2 }}>
          What have you already locked in?
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', margin: '0 0 32px 0' }}>
          Select everything you've already booked. We'll focus your planning on what's left.
        </p>

        {/* Tile grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '32px',
        }}>
          {VENDOR_TILES.map(tile => {
            const isSelected = selected.has(tile.category)
            return (
              <button
                key={tile.category}
                type="button"
                onClick={() => toggle(tile.category)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '20px 12px',
                  borderRadius: '12px',
                  border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: isSelected ? 'rgba(184,146,106,0.08)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {/* Checkmark badge */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{tile.emoji}</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  {tile.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'opacity 0.15s',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Next →'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              textDecoration: 'underline',
              padding: '4px 8px',
            }}
          >
            Nothing booked yet — skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
