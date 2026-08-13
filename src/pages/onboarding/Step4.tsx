import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import { OnboardingShell, StepIndicator, BackLink, Eyebrow, Title, Subtitle } from './chrome'
import { labelStyle, coupleLine } from './steps'
import { BUDGET_RANGES, budgetRangeToTotal } from '../../lib/budget'

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
        if (city) updates.city = city
        if (budgetRange) {
          updates.budget_range = budgetRange
          // Give them a working budget_total straight away. Everything that
          // actually renders a budget (dashboard ring, % committed, timeline
          // status) reads budget_total, so without this the range they just
          // picked would show as "Set in Settings" on arrival.
          const derived = budgetRangeToTotal(budgetRange)
          if (derived) updates.budget_total = derived
        }
      }
      await updateCouple(coupleId, updates)
      // Router state (not localStorage) so the celebration is tied to *this*
      // navigation — a later refresh of the dashboard won't replay it.
      navigate('/', { state: { justOnboarded: true } })
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
            {budgetRangeToTotal(budgetRange) && (
              <p className="page-fade-in" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
                We'll start you at{' '}
                <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                  ${budgetRangeToTotal(budgetRange)!.toLocaleString()}
                </span>
                {' '}so your budget works right away. Fine-tune it any time in Settings.
              </p>
            )}
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

