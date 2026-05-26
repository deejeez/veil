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

      // Create the couple record
      const { error: insertError } = await supabase.from('couples').insert({
        user_id_primary: user.id,
        email_primary: email,
      })
      if (insertError) throw insertError

      navigate('/onboarding/1')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
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
          Plan your wedding, your way
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ padding: '10px 12px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '14px', background: 'var(--color-surface)' }}
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '20px' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
