import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'

const BUDGET_RANGES = [
  { value: 'under_50k',    label: 'Under $50,000' },
  { value: '50k_100k',     label: '$50,000 – $100,000' },
  { value: '100k_150k',    label: '$100,000 – $150,000' },
  { value: '150k_200k',    label: '$150,000 – $200,000' },
  { value: '200k_300k',    label: '$200,000 – $300,000' },
  { value: 'over_300k',    label: 'Over $300,000' },
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

export default function OnboardingStep3() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [guestCount, setGuestCount] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      if (couple.guest_count) setGuestCount(String(couple.guest_count))
      if (couple.budget_range) setBudgetRange(couple.budget_range)
      if (couple.city) setCity(couple.city)
    }
    load()
  }, [])

  async function finish(skip = false) {
    if (!coupleId || saving) return
    setSaving(true)
    try {
      const updates: Parameters<typeof updateCouple>[1] = {
        onboarding_complete: true,
      }
      if (!skip) {
        if (guestCount) updates.guest_count = Number(guestCount)
        if (budgetRange) updates.budget_range = budgetRange
        if (city) updates.city = city
      }
      await updateCouple(coupleId, updates)
      navigate('/')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
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

      <div style={{ width: '100%', maxWidth: '460px' }}>
        <StepIndicator current={3} />

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
          Step 3 of 3
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.2 }}>
          A few more details
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', margin: '0 0 36px 0' }}>
          Optional — you can always update these in Settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          <div>
            <label style={labelStyle}>Approximate guest count</label>
            <input
              type="number"
              placeholder="e.g. 150"
              min="1"
              max="2000"
              value={guestCount}
              onChange={e => setGuestCount(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Total budget range</label>
            <select
              value={budgetRange}
              onChange={e => setBudgetRange(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">Select a range...</option>
              {BUDGET_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>City / Region</label>
            <input
              type="text"
              placeholder="e.g. New York, NY"
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => finish(false)}
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
          {saving ? 'Saving...' : 'Start Planning →'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => finish(true)}
            disabled={saving}
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
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '6px',
}
