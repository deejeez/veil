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
    async function checkAlreadyPaid() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (couple?.paid) navigate('/')
    }
    checkAlreadyPaid()
  }, [navigate])

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          success_url: `${window.location.origin}/payment-success`,
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-accent)', marginBottom: '28px', letterSpacing: '0.04em' }}>
          Veil
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: '12px', lineHeight: 1.2 }}>
          Plan your wedding without the chaos
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '32px', lineHeight: 1.6 }}>
          One place for your vendors, budget, timeline, and all the decisions in between. Powered by AI that actually knows what you should be doing next.
        </p>

        <Card style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
            $149
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
            One-time. Yours forever.
          </p>
          <ul style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 2, paddingLeft: '16px', margin: '0 0 24px 0' }}>
            <li>AI finds and ranks local vendors that match your style and budget</li>
            <li>Your timeline tells you what's urgent and what you're behind on</li>
            <li>Upload a contract and get a plain-English breakdown in seconds</li>
            <li>Track every dollar, payment, and contribution in one place</li>
          </ul>
          {error && <p style={{ color: '#C4785C', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <Button onClick={handleCheckout} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Redirecting...' : 'Get Started · $149'}
          </Button>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px', textAlign: 'center' }}>
            Have a promo code? Enter it at checkout.
          </p>
        </Card>
      </div>
    </div>
  )
}
