import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import { setBookedVenue } from '../../lib/vendors'
import {
  OnboardingShell, StepIndicator, BackLink, Eyebrow, Title, Subtitle, PrimaryButton,
} from './chrome'
import { labelStyle } from './steps'

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

/** Whole days from today to the given ISO date. Null when unparseable. */
function daysUntil(iso: string): number | null {
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export default function OnboardingStep2() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [exactDate, setExactDate] = useState('')
  const [noExactDate, setNoExactDate] = useState(false)
  const [season, setSeason] = useState<string>('')
  const [year, setYear] = useState<number>(new Date().getFullYear() + 1)
  // A locked-in date usually means the venue is already booked — the venue is
  // what fixes the date, not the other way round. Only asked when they give an
  // exact date; couples still shopping for a date answer this in step 3.
  const [hasVenue, setHasVenue] = useState<boolean | null>(null)
  const [venueName, setVenueName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      if (couple.name_primary) setFirstName(couple.name_primary)
      if (couple.wedding_date && !couple.target_season) setExactDate(couple.wedding_date)
      if (couple.target_season) { setNoExactDate(true); setSeason(couple.target_season) }
      if (couple.target_year) setYear(couple.target_year)
      if (couple.venue_name) { setHasVenue(true); setVenueName(couple.venue_name) }
    }
    load()
  }, [])

  const hasDate = exactDate !== '' || (noExactDate && season !== '')
  const showVenueQuestion = !noExactDate && exactDate !== ''
  // If they say they have a venue, we need its name — otherwise "yes" records
  // nothing and the Venue page still shows an empty state.
  const venueAnswered = !showVenueQuestion || hasVenue === false
    || (hasVenue === true && venueName.trim() !== '')
  const canProceed = hasDate && venueAnswered
  const countdown = noExactDate ? null : daysUntil(exactDate)

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
      if (showVenueQuestion && hasVenue && venueName.trim()) {
        await setBookedVenue(coupleId, venueName)
      }
      navigate('/onboarding/3')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingShell>
      <StepIndicator current={2} />
      <BackLink to="/onboarding/1" />

      <Eyebrow current={2} />
      <Title>{firstName ? `When's the big day, ${firstName}?` : "When's the big day?"}</Title>
      <Subtitle>
        Everything starts here. Your date drives your timeline, vendor availability, and what we'll nudge you about.
      </Subtitle>

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

      {/* Countdown reveal — the payoff for picking a date, at the moment of
          highest emotional charge rather than three screens later. */}
      {countdown !== null && countdown >= 0 && (
        <div
          className="page-fade-in"
          aria-live="polite"
          style={{
            padding: '16px',
            marginBottom: '20px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, color: 'var(--color-accent)', margin: 0, lineHeight: 1.1 }}>
            {countdown === 0 ? 'Today!' : countdown.toLocaleString()}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 0 0' }}>
            {countdown === 0 ? 'Congratulations!' : `${countdown === 1 ? 'day' : 'days'} to go`}
          </p>
        </div>
      )}

      {/* Venue follow-up. A fixed date almost always means the venue is booked,
          since the venue is usually what fixes the date. */}
      {showVenueQuestion && (
        <div className="page-fade-in" style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Have you booked your venue?</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { value: true,  label: 'Yes, it’s booked' },
              { value: false, label: 'Not yet' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  setHasVenue(opt.value)
                  if (!opt.value) setVenueName('')
                }}
                style={{
                  padding: '14px 12px',
                  borderRadius: '10px',
                  border: `1.5px solid ${hasVenue === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: hasVenue === opt.value ? 'rgba(184,146,106,0.08)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: hasVenue === opt.value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasVenue === true && (
            <div className="page-fade-in" style={{ marginTop: '14px' }}>
              <label style={labelStyle} htmlFor="venue-name">Venue name</label>
              <input
                id="venue-name"
                type="text"
                autoFocus
                value={venueName}
                onChange={e => setVenueName(e.target.value)}
                placeholder="e.g. Liberty Warehouse"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
                We'll mark your venue as booked and set up its page for you.
              </p>
            </div>
          )}
        </div>
      )}

      {/* No exact date toggle */}
      <button
        type="button"
        onClick={() => {
          const next = !noExactDate
          setNoExactDate(next)
          if (next) { setExactDate(''); setHasVenue(null); setVenueName('') }
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
        <PrimaryButton onClick={handleNext} disabled={!canProceed || saving}>
          {saving ? 'Saving...' : 'Next →'}
        </PrimaryButton>
      </div>
    </OnboardingShell>
  )
}
