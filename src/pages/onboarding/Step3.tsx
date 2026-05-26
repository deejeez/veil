import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser } from '../../lib/couple'
import Button from '../../components/Button'
import { track } from '../../lib/analytics'

export default function OnboardingStep3() {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function generateTimeline() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const couple = await getCoupleForUser(user.id)
        if (!couple) { setLoading(false); return }

        const { data, error: fnError } = await supabase.functions.invoke('planning-timeline', {
          body: { couple_id: couple.id },
        })
        if (fnError) throw fnError

        setInsight(data.summary)
      } catch {
        setError("Couldn't generate your timeline — you can refresh it from the dashboard.")
        setInsight("Welcome to Veil. Head to your dashboard to check your planning timeline.")
      } finally {
        setLoading(false)
      }
    }
    generateTimeline()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Step 3 of 3
        </p>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', marginBottom: '24px', fontWeight: 400 }}>
          {loading ? 'Building your timeline...' : "You're set up"}
        </h2>

        {loading && (
          <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
            AI is personalizing your planning timeline...
          </p>
        )}

        {!loading && insight && (
          <div style={{ padding: '20px', border: '1px solid var(--color-accent)', background: 'rgba(200,169,110,0.06)', textAlign: 'left', marginBottom: '24px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: '8px' }}>
              AI Advisor
            </p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: 0 }}>
              {insight}
            </p>
          </div>
        )}

        {error && <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

        <Button onClick={() => { track('onboarding_complete'); navigate('/') }} disabled={loading}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
