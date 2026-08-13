import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import { OnboardingShell, StepIndicator, BackLink, Eyebrow, Title, Subtitle } from './chrome'
import { labelStyle, coupleLine } from './steps'

const BUDGET_RANGES = [
  { value: 'under_25k',    label: 'Under $25,000' },
  { value: '25k_50k',      label: '$25,000 – $50,000' },
  { value: '50k_100k',     label: '$50,000 – $100,000' },
  { value: '100k_150k',    label: '$100,000 – $150,000' },
  { value: '150k_250k',    label: '$150,000 – $250,000' },
  { value: 'over_250k',    label: 'Over $250,000' },
] as const

export default function OnboardingStep4() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [guestCount, setGuestCount] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [city, setCity] = useState('')
  const [names, setNames] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      setNames(coupleLine(couple.name_primary, couple.name_partner))
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
    <OnboardingShell>
      <StepIndicator current={4} />
      <BackLink to="/onboarding/3" />

      <Eyebrow current={4} />
      <Title>Almost there</Title>
      <Subtitle>
        These help us give you smarter recommendations. You can always change them later.
      </Subtitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          <div>
            <label style={labelStyle}>How many guests (roughly)</label>
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
              placeholder="e.g. New York City, Nashville"
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
          {saving
            ? 'Saving...'
            : names ? `Let's plan ${names}'s wedding →` : "Let's Go →"}
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
    </OnboardingShell>
  )
}

