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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ width: '360px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
          Veil
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          Sign in to your account
        </p>

        {error && (
          <p style={{ color: '#B91C1C', fontSize: '13px', marginBottom: '16px', fontFamily: 'var(--font-body)' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '10px 12px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '14px', background: 'var(--color-surface)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '10px 12px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '14px', background: 'var(--color-surface)' }}
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '20px' }}>
          No account? <Link to="/signup" style={{ color: 'var(--color-accent)' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
