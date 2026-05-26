import { type FormEvent, type CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import Button from '../../components/Button'

export default function OnboardingStep1() {
  const [weddingDate, setWeddingDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [budgetTotal, setBudgetTotal] = useState('')
  const [emailPartner, setEmailPartner] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const inputStyle: CSSProperties = {
    display: 'block',
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const couple = await getCoupleForUser(user.id)
      if (!couple) throw new Error('Couple record not found')

      await updateCouple(couple.id, {
        wedding_date: weddingDate || null,
        venue_name: venueName || null,
        city: city || null,
        state: state || null,
        budget_total: budgetTotal ? Number(budgetTotal) : null,
        email_partner: emailPartner || null,
      })

      navigate('/onboarding/2')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ((err as { message?: string }).message ?? 'Failed to save'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
          Step 1 of 3
        </p>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', marginBottom: '8px', fontWeight: 400 }}>
          The basics
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
          Tell us about your big day.
        </p>

        {error && <p style={{ color: '#B91C1C', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Wedding Date
            </label>
            <input type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Venue Name (optional)
            </label>
            <input type="text" placeholder="Liberty Warehouse" value={venueName} onChange={e => setVenueName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                City
              </label>
              <input type="text" placeholder="New York" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                State
              </label>
              <input type="text" placeholder="NY" maxLength={2} value={state} onChange={e => setState(e.target.value.toUpperCase())} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Total Budget ($)
            </label>
            <input type="number" placeholder="150000" value={budgetTotal} onChange={e => setBudgetTotal(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Partner's Email (optional — invite them later)
            </label>
            <input type="email" placeholder="partner@email.com" value={emailPartner} onChange={e => setEmailPartner(e.target.value)} style={inputStyle} />
          </div>

          <Button type="submit" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
