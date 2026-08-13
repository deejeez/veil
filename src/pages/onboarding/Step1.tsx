import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import {
  OnboardingShell, StepIndicator, Eyebrow, Title, Subtitle, PrimaryButton,
} from './chrome'
import { labelStyle, coupleLine } from './steps'

export default function OnboardingStep1() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [namePrimary, setNamePrimary] = useState('')
  const [namePartner, setNamePartner] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      if (couple.name_primary) setNamePrimary(couple.name_primary)
      if (couple.name_partner) setNamePartner(couple.name_partner)
    }
    load()
  }, [])

  // Partner name is optional — plenty of people set this up before their
  // partner has joined, and they can add it later in Settings.
  const canProceed = namePrimary.trim() !== ''
  const preview = coupleLine(namePrimary, namePartner)

  async function handleNext() {
    if (!coupleId || !canProceed || saving) return
    setSaving(true)
    try {
      await updateCouple(coupleId, {
        name_primary: namePrimary.trim(),
        name_partner: namePartner.trim() || null,
      })
      navigate('/onboarding/2')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingShell>
      <StepIndicator current={1} />

      <Eyebrow current={1} />
      <Title>Who's getting married?</Title>
      <Subtitle>
        We'll use your names throughout Veil, so the whole thing feels like yours rather than a spreadsheet.
      </Subtitle>

      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle} htmlFor="name-primary">Your first name</label>
        <input
          id="name-primary"
          type="text"
          autoFocus
          autoComplete="given-name"
          value={namePrimary}
          onChange={e => setNamePrimary(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canProceed) handleNext() }}
          placeholder="e.g. Marco"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle} htmlFor="name-partner">
          Your partner's first name <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <input
          id="name-partner"
          type="text"
          autoComplete="off"
          value={namePartner}
          onChange={e => setNamePartner(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canProceed) handleNext() }}
          placeholder="e.g. Sarah"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Live preview — shows the couple line exactly as it appears on the
          dashboard, so the form produces something instead of just collecting. */}
      <div
        aria-live="polite"
        style={{
          minHeight: '86px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '18px',
          marginBottom: '28px',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          transition: 'opacity 0.2s',
          opacity: preview ? 1 : 0.55,
        }}
      >
        {preview ? (
          <>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 400, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2, textAlign: 'center' }}>
              {namePrimary.trim()}
              {namePartner.trim() && (
                <> <span style={{ color: 'var(--color-accent)' }}>&</span> {namePartner.trim()}</>
              )}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
              This is how you'll appear across Veil
            </p>
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            Your names will appear here
          </p>
        )}
      </div>

      <PrimaryButton onClick={handleNext} disabled={!canProceed || saving}>
        {saving ? 'Saving...' : 'Next →'}
      </PrimaryButton>
    </OnboardingShell>
  )
}
