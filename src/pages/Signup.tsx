import { type FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Button from '../components/Button'

export default function Signup() {
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
      const { user } = await signUp(email, password)
      if (!user) throw new Error('Signup failed — no user returned')

      const { error: insertError } = await supabase.from('couples').insert({
        user_id_primary: user.id,
        email_primary: email,
      })
      if (insertError) throw insertError

      navigate('/onboarding/1')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ((err as { message?: string }).message ?? 'Signup failed'))
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
          Plan your wedding, your way
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <div style={{ marginTop: '4px' }}>
            <Button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>
        </form>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '24px', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
