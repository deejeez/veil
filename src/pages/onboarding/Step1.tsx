import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'

const SEASONS = [
  { value: 'spring', label: 'Spring', months: 'Mar – May' },
  { value: 'summer', label: 'Summer', months: 'Jun – Aug' },
  { value: 'fall',   label: 'Fall',   months: 'Sep – Nov' },
  { value: 'winter', label: 'Winter', months: 'Dec – Feb' },
] as const

function makeYearOptions() {
  const current = new Date().getFullYear()
  return [current, current + 1, current + 2, current + 3]
}

function seasonToApproxDate(season: string, year: number): string {
  const map: Record<string, string> = {
    spring: `${year}-05-15`,
    summer: `${year}-07-15`,
    fall:   `${year}-10-01`,
    winter: `${year}-12-15`,
  }
  return map[season] ?? `${year}-06-15`
}

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

export default function OnboardingStep1() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [exactDate, setExactDate] = useState('')
  const [noExactDate, setNoExactDate] = useState(false)
  const [season, setSeason] = useState<string>('')
  const [year, setYear] = useState<number>(new Date().getFullYear() + 1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      if (couple.wedding_date && !couple.target_season) setExactDate(couple.wedding_date)
      if (couple.target_season) { setNoExactDate(true); setSeason(couple.target_season) }
      if (couple.target_year) setYear(couple.target_year)
    }
    load()
  }, [])

  const canProceed = exactDate !== '' || (noExactDate && season !== '')

  async function handleNext() {
    if (!coupleId || !canProceed || saving) return
    setSaving(true)
    try {
      if (noExactDate && season) {
        await updateCouple(coupleId, {
          wedding_date: seasonToApproxDate(season, year),
          target_season: season as 'spring' | 'summer' | 'fall' | 'winter',
          target_year: year,
        })
      } else if (exactDate) {
        await updateCouple(coupleId, {
          wedding_date: exactDate,
          target_season: null,
          target_year: null,
        })
      }
      navigate('/onboarding/2')
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
        <StepIndicator current={1} />

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
          Step 1 of 3
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.2 }}>
          When's the big day?
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', margin: '0 0 36px 0' }}>
          Everything starts here. Your date drives your timeline, vendor availability, and what we'll nudge you about.
        </p>

        {/* Exact date */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Wedding date</label>
          <input
            type="date"
            value={exactDate}
            disabled={noExactDate}
            onChange={e => { setExactDate(e.target.value); setNoExactDate(false) }}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              opacity: noExactDate ? 0.4 : 1,
            }}
          />
        </div>

        {/* No exact date toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !noExactDate
            setNoExactDate(next)
            if (next) setExactDate('')
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: noExactDate ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            fontSize: '14px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            marginBottom: noExactDate ? '28px' : '0',
          }}
        >
          <span style={{
            width: '18px',
            height: '18px',
            border: `2px solid ${noExactDate ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '4px',
            background: noExactDate ? 'var(--color-accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}>
            {noExactDate && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          We don't have an exact date yet
        </button>

        {/* Season + Year fallback */}
        {noExactDate && (
          <div className="page-fade-in">
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Target season</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {SEASONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeason(s.value)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: '10px',
                      border: `1.5px solid ${season === s.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: season === s.value ? 'rgba(184,146,106,0.08)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600, color: season === s.value ? 'var(--color-accent)' : 'var(--color-text-primary)', marginBottom: '2px' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{s.months}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Target year</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              >
                {makeYearOptions().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{ marginTop: noExactDate ? '0' : '32px' }}>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || saving}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              background: canProceed ? 'var(--color-accent)' : 'var(--color-border)',
              color: canProceed ? '#fff' : 'var(--color-text-muted)',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving...' : 'Next →'}
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
