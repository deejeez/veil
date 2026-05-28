import { type FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn } from '../lib/auth'
import Button from '../components/Button'
import { identifyUser } from '../lib/analytics'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) identifyUser(user.id, user.email ?? '')
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '24px' }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'var(--color-surface)',
        borderRadius: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.08)',
        padding: '48px 44px',
      }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 400, color: 'var(--color-accent)', marginBottom: '4px', letterSpacing: '0.04em' }}>
          Veil
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '36px' }}>
          Sign in to your account
        </p>

        {error && (
          <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
            <p style={{ color: '#C4785C', fontSize: '14px', margin: 0, fontFamily: 'var(--font-body)' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <div style={{ marginTop: '4px' }}>
            <Button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '24px', textAlign: 'center' }}>
          No account?{' '}
          <Link to="/signup" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
