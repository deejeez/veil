import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import { markCategoryBooked } from '../../lib/vendors'
import type { Couple } from '../../types/database'
import { OnboardingShell, StepIndicator, BackLink, Eyebrow, Title, Subtitle } from './chrome'

const VENDOR_TILES = [
  { category: 'venue',           label: 'Venue',           icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V9L12 2l9 7v13H3z" />
      <path d="M9 22V16h6v6" />
    </svg>
  )},
  { category: 'photographer',    label: 'Photographer',    icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )},
  { category: 'videographer',    label: 'Videographer',    icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )},
  { category: 'caterer',         label: 'Caterer',         icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )},
  { category: 'florist',         label: 'Florist',         icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )},
  { category: 'band_dj',         label: 'DJ / Band',       icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )},
  { category: 'wedding_planner', label: 'Wedding Planner', icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )},
  { category: 'officiant',       label: 'Officiant',       icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )},
] as const

const VIBE_TILES = [
  { value: 'classic_elegant',      label: 'Classic & Elegant' },
  { value: 'modern_minimal',       label: 'Modern & Minimal' },
  { value: 'rustic_natural',       label: 'Rustic & Natural' },
  { value: 'bohemian_free',        label: 'Bohemian & Free-spirited' },
  { value: 'glamorous_bold',       label: 'Glamorous & Bold' },
] as const

type VibeValue = typeof VIBE_TILES[number]['value']

export default function OnboardingStep3() {
  const navigate = useNavigate()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [vibes, setVibes] = useState<Set<VibeValue>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      if (c.vibe_profile?.vibes?.length) {
        setVibes(new Set(c.vibe_profile.vibes as VibeValue[]))
      }
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

  function toggleVibe(value: VibeValue) {
    setVibes(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function saveVibes() {
    if (!couple) return
    const vibeArray = Array.from(vibes)
    localStorage.setItem('veil_onboarding_vibe', JSON.stringify(vibeArray))
    await updateCouple(couple.id, {
      vibe_profile: { ...(couple.vibe_profile ?? {}), vibes: vibeArray },
    })
  }

  async function handleNext() {
    if (!couple || saving) return
    setSaving(true)
    try {
      const selectedCategories = Array.from(selected)
      await Promise.all([
        // Reuses the placeholder row for the category instead of inserting a
        // second booked row alongside it (e.g. the venue captured in step 2).
        ...selectedCategories.map(category => {
          const tile = VENDOR_TILES.find(t => t.category === category)
          return markCategoryBooked(couple.id, category, tile?.label ?? null)
        }),
        saveVibes(),
      ])
      localStorage.setItem('veil_onboarding_booked', JSON.stringify(selectedCategories))
      navigate('/onboarding/4')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    localStorage.setItem('veil_onboarding_booked', JSON.stringify([]))
    try {
      await saveVibes()
    } catch {
      // vibe save failure shouldn't block onboarding
    }
    navigate('/onboarding/4')
  }

  return (
    <OnboardingShell maxWidth="520px">
      <StepIndicator current={3} />
      <BackLink to="/onboarding/2" />

      <Eyebrow current={3} />
      <Title>What have you knocked out so far?</Title>
      <Subtitle>
        Tap anything that's already handled. We'll skip past it and focus on what's next.
      </Subtitle>

        {/* Vibe section */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 12px 0' }}>
            What's your vibe?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {VIBE_TILES.map(tile => {
              const isSelected = vibes.has(tile.value)
              return (
                <button
                  key={tile.value}
                  type="button"
                  onClick={() => toggleVibe(tile.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: isSelected ? 'rgba(184,146,106,0.08)' : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSelected && (
                    <span style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                  {tile.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '0 0 24px 0' }} />

        {/* Vendor tile grid */}
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
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
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
                {tile.icon}
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
            Skip for now
          </button>
        </div>
    </OnboardingShell>
  )
}
