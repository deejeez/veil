import { type FormEvent, useState, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { signIn, signUp } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { identifyUser } from '../lib/analytics'

type Tab = 'signup' | 'login'
type View = 'form' | 'forgot' | 'forgot-sent'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function PasswordInput({
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        style={{ width: '100%', paddingRight: '44px' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
        }}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  )
}

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()

  const initialTab: Tab = location.pathname === '/login' ? 'login' : 'signup'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [view, setView] = useState<View>('form')

  // Shared
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Validation touch state
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')

  // Derived validation
  const emailValid = isValidEmail(email)
  const passwordLongEnough = password.length >= 8
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const signupDisabled = !emailValid || !passwordLongEnough || !passwordsMatch || loading
  const loginDisabled = !email || !password || loading

  const confirmStatus = useMemo(() => {
    if (!confirmTouched || confirmPassword.length === 0) return null
    return passwordsMatch ? 'match' : 'mismatch'
  }, [confirmTouched, confirmPassword, passwordsMatch])

  function switchTab(t: Tab) {
    setTab(t)
    setView('form')
    setError(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setConfirmTouched(false)
    setEmailTouched(false)
    setPasswordTouched(false)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) identifyUser(user.id, user.email ?? '')
      navigate('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Invalid email or password. Please try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user } = await signUp(email, password)
      if (!user) throw new Error('Signup failed. Please try again.')

      const { error: insertError } = await supabase.from('couples').insert({
        user_id_primary: user.id,
        email_primary: email,
      })
      if (insertError) {
        if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
          throw new Error('An account with this email already exists. Try logging in instead.')
        }
        throw insertError
      }

      navigate('/paywall')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ((err as { message?: string }).message ?? 'Signup failed')
      if (msg.includes('already exists') || msg.includes('already registered') || msg.includes('already been registered')) {
        setError('An account with this email already exists. Try logging in instead.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSentTo(forgotEmail)
      setView('forgot-sent')
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    padding: '12px 14px',
    border: '1.5px solid var(--color-border)',
    borderRadius: '8px',
    background: '#fff',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '440px',
    background: 'var(--color-surface)',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    boxShadow: '0 1px 3px rgba(140,120,100,0.08), 0 4px 12px rgba(140,120,100,0.05)',
    padding: '40px 40px 36px',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '24px',
    }}>
      <style>{`
        .auth-input:focus {
          border-color: var(--color-accent) !important;
        }
        .auth-input::placeholder {
          color: var(--color-text-muted);
        }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 400,
          color: 'var(--color-accent)', margin: '0 0 2px 0', letterSpacing: '0.04em',
        }}>
          Veil
        </h1>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0,
        }}>
          Wedding Planner
        </p>
      </div>

      <div style={cardStyle}>

        {/* Tabs */}
        {view === 'form' && (
          <div style={{ display: 'flex', gap: '0', marginBottom: '28px', borderBottom: '1.5px solid var(--color-border)' }}>
            {(['signup', 'login'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '0 0 12px 0',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-1.5px',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {t === 'signup' ? 'Create Account' : 'Log In'}
              </button>
            ))}
          </div>
        )}

        {/* ── SIGNUP FORM ──────────────────────────────────── */}
        {view === 'form' && tab === 'signup' && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Let's plan your wedding
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--color-text-secondary)', margin: '0 0 24px 0',
            }}>
              Create your account to get started.
            </p>

            {error && (
              <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ color: '#C4785C', fontSize: '13px', margin: 0, fontFamily: 'var(--font-body)' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoComplete="email"
                  style={inputStyle}
                />
                {emailTouched && email.length > 0 && !emailValid && (
                  <p style={{ fontSize: '12px', color: '#C4785C', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                    Please enter a valid email
                  </p>
                )}
              </div>

              <div>
                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                {passwordTouched && password.length > 0 && !passwordLongEnough ? (
                  <p style={{ fontSize: '12px', color: '#C4785C', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                    Password must be at least 8 characters
                  </p>
                ) : (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                    At least 8 characters
                  </p>
                )}
              </div>

              <div>
                <PasswordInput
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={v => { setConfirmPassword(v); if (!confirmTouched) setConfirmTouched(true) }}
                  autoComplete="new-password"
                />
                {confirmStatus === 'mismatch' && (
                  <p style={{ fontSize: '12px', color: '#C4785C', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                    Passwords don't match
                  </p>
                )}
                {confirmStatus === 'match' && (
                  <p style={{ fontSize: '12px', color: '#7B8F6B', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                    Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={signupDisabled}
                onBlur={() => setPasswordTouched(true)}
                style={{
                  width: '100%', marginTop: '4px',
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  background: signupDisabled ? '#D4CFC8' : 'var(--color-accent)',
                  color: '#fff', cursor: signupDisabled ? 'default' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '12px',
              color: 'var(--color-text-secondary)', marginTop: '12px', textAlign: 'center', lineHeight: 1.5,
            }}>
              By creating your account, you agree to our{' '}
              <Link to="/terms" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>
          </>
        )}

        {/* ── LOGIN FORM ───────────────────────────────────── */}
        {view === 'form' && tab === 'login' && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Welcome back
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--color-text-secondary)', margin: '0 0 24px 0',
            }}>
              Log in to your wedding planner.
            </p>

            {error && (
              <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ color: '#C4785C', fontSize: '13px', margin: 0, fontFamily: 'var(--font-body)' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="auth-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                style={inputStyle}
              />

              <div>
                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setForgotEmail(email); setForgotError(null) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', fontWeight: 500,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginDisabled}
                style={{
                  width: '100%', marginTop: '4px',
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  background: loginDisabled ? '#D4CFC8' : 'var(--color-accent)',
                  color: '#fff', cursor: loginDisabled ? 'default' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {loading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '12px',
              color: 'var(--color-text-muted)', marginTop: '20px', textAlign: 'center',
            }}>
              <Link to="/privacy" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
              <span style={{ margin: '0 8px' }}>·</span>
              <Link to="/terms" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
            </p>
          </>
        )}

        {/* ── FORGOT PASSWORD ─────────────────────────────── */}
        {view === 'forgot' && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Reset your password
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--color-text-secondary)', margin: '0 0 24px 0',
            }}>
              Enter your email and we'll send you a reset link.
            </p>

            {forgotError && (
              <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ color: '#C4785C', fontSize: '13px', margin: 0, fontFamily: 'var(--font-body)' }}>{forgotError}</p>
              </div>
            )}

            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="auth-input"
                type="email"
                placeholder="Email address"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                autoComplete="email"
                required
                style={inputStyle}
              />

              <button
                type="submit"
                disabled={!isValidEmail(forgotEmail) || forgotLoading}
                style={{
                  width: '100%', marginTop: '4px',
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  background: !isValidEmail(forgotEmail) || forgotLoading ? '#D4CFC8' : 'var(--color-accent)',
                  color: '#fff', cursor: !isValidEmail(forgotEmail) || forgotLoading ? 'default' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setView('form'); setForgotError(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', fontWeight: 500 }}
              >
                Back to login
              </button>
            </p>
          </>
        )}

        {/* ── FORGOT PASSWORD SENT ────────────────────────── */}
        {view === 'forgot-sent' && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Check your email
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: 1.6,
              color: 'var(--color-text-secondary)', margin: '0 0 4px 0',
            }}>
              We've sent a password reset link to <strong style={{ color: 'var(--color-text-primary)' }}>{sentTo}</strong>. It may take a minute to arrive. Check your spam folder if you don't see it.
            </p>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '24px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setView('form'); setTab('login'); setForgotError(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', fontWeight: 500 }}
              >
                Back to login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
