import { type FormEvent, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        style={{
          width: '100%', paddingRight: '44px',
          fontFamily: 'var(--font-body)', fontSize: '14px',
          padding: '12px 44px 12px 14px',
          border: '1.5px solid var(--color-border)',
          borderRadius: '8px', background: '#fff',
          color: 'var(--color-text-primary)', outline: 'none',
          transition: 'border-color 0.15s ease',
        }}
        className="auth-input"
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

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  const passwordLongEnough = password.length >= 8
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const disabled = !passwordLongEnough || !passwordsMatch || loading

  const confirmStatus = useMemo(() => {
    if (!confirmTouched || confirmPassword.length === 0) return null
    return passwordsMatch ? 'match' : 'mismatch'
  }, [confirmTouched, confirmPassword, passwordsMatch])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also check if we already have a session (user may have already been set by the hash)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
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

        {/* ── SUCCESS STATE ────────────────────────────── */}
        {success && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Password updated
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: 1.6,
              color: 'var(--color-text-secondary)', margin: '0 0 24px 0',
            }}>
              Your password has been reset. You can now log in with your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                background: 'var(--color-accent)', color: '#fff', cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              Go to Login
            </button>
          </>
        )}

        {/* ── NOT READY (waiting for token) ────────────── */}
        {!success && !ready && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Set your new password
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--color-text-secondary)', margin: '0',
            }}>
              Loading your reset session...
            </p>
          </>
        )}

        {/* ── RESET FORM ───────────────────────────────── */}
        {!success && ready && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 4px 0',
            }}>
              Set your new password
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '14px',
              color: 'var(--color-text-secondary)', margin: '0 0 24px 0',
            }}>
              Choose a new password for your account.
            </p>

            {error && (
              <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ color: '#C4785C', fontSize: '13px', margin: 0, fontFamily: 'var(--font-body)' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <PasswordInput
                  placeholder="New password"
                  value={password}
                  onChange={setPassword}
                />
                <p style={{ fontSize: '11px', color: passwordLongEnough ? 'var(--color-text-muted)' : 'var(--color-text-muted)', margin: '4px 0 0 2px', fontFamily: 'var(--font-body)' }}>
                  At least 8 characters
                </p>
              </div>

              <div>
                <PasswordInput
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={v => { setConfirmPassword(v); if (!confirmTouched) setConfirmTouched(true) }}
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
                disabled={disabled}
                style={{
                  width: '100%', marginTop: '4px',
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  background: disabled ? '#D4CFC8' : 'var(--color-accent)',
                  color: '#fff', cursor: disabled ? 'default' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
