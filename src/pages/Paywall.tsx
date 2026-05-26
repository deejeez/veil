import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import Button from '../components/Button'
import Card from '../components/Card'

export default function Paywall() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Poll for paid status after returning from Stripe (for up to 30s)
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const couple = await getCoupleForUser(user.id)
        if (couple?.paid) {
          clearInterval(interval)
          navigate('/onboarding/2')
        }
        if (attempts >= 6) {
          clearInterval(interval)
          setError('Payment processing — refresh in a minute')
        }
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [navigate])

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          success_url: `${window.location.origin}/paywall?success=1`,
          cancel_url: `${window.location.origin}/paywall`,
        },
      })
      if (fnError) throw fnError
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
          Veil
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
          Your AI-powered wedding planning hub
        </p>

        <Card style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
            $149
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
            One-time. Yours forever.
          </p>
          <ul style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 2, paddingLeft: '16px', margin: '0 0 24px 0' }}>
            <li>AI vendor shortlists — local vendors ranked against your vibe</li>
            <li>AI contract review — flags cancellation, overtime, deposit clauses</li>
            <li>Personalized planning timeline — "are you behind?" with specifics</li>
            <li>Budget + payment tracking with family cost splitting</li>
          </ul>
          {error && <p style={{ color: '#B91C1C', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <Button onClick={handleCheckout} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Redirecting...' : 'Get Started — $149'}
          </Button>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px', textAlign: 'center' }}>
            Have a promo code? Enter it at checkout.
          </p>
        </Card>
      </div>
    </div>
  )
}
