import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

export default function PaymentSuccess() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>

        {/* Checkmark icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(200,169,110,0.15)',
          border: '2px solid var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '20px',
          letterSpacing: '0.08em',
          color: 'var(--color-accent)',
          margin: '0 0 20px 0',
          lineHeight: 1,
        }}>
          Veil
        </p>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '36px',
          fontWeight: 400,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}>
          Welcome to Veil
        </h1>

        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
          marginBottom: '40px',
        }}>
          Payment confirmed. Let's get your planner set up — takes about two minutes.
        </p>

        <Button onClick={() => navigate('/onboarding/1')} style={{ width: '100%' }}>
          Get Started
        </Button>
      </div>
    </div>
  )
}
