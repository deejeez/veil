import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function linkPartner() {
      try {
        const coupleId = searchParams.get('couple_id')
        if (!coupleId) {
          setErrorMsg('Missing couple ID in invite link.')
          setStatus('error')
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // Not yet signed in — the magic link will sign them in and redirect
          // back here. If we still have no user, send to login.
          navigate(`/login?redirect=/accept-invite?couple_id=${coupleId}`, { replace: true })
          return
        }

        // Claim the invitation. `.select()` matters: without it a zero-row
        // update returns no error, which is exactly how invited partners were
        // told "You're in" while staying unlinked — and then hit the paywall,
        // since with no couple nothing recorded that it had already been paid.
        const { data: claimed, error } = await supabase
          .from('couples')
          .update({ user_id_partner: user.id })
          .eq('id', coupleId)
          .is('user_id_partner', null)
          .select('id')

        if (error) {
          setErrorMsg(`Could not link your account: ${error.message}`)
          setStatus('error')
          return
        }

        if (!claimed || claimed.length === 0) {
          // Either someone already claimed it, or this account isn't the one
          // that was invited. Distinguish, so the message is actionable.
          const { data: existing } = await supabase
            .from('couples')
            .select('id, user_id_partner')
            .eq('id', coupleId)
            .maybeSingle()

          if (existing?.user_id_partner === user.id) {
            setStatus('success')                       // already linked — fine
            setTimeout(() => navigate('/', { replace: true }), 1200)
            return
          }

          setErrorMsg(
            existing?.user_id_partner
              ? 'This invitation has already been used by another account.'
              : `This invitation was sent to a different email address. You're signed in as ${user.email}. Sign in with the invited address, or ask your partner to re-send the invite to this one.`
          )
          setStatus('error')
          return
        }

        setStatus('success')
        setTimeout(() => navigate('/', { replace: true }), 1500)
      } catch (err) {
        setErrorMsg(String(err))
        setStatus('error')
      }
    }

    linkPartner()
  }, [searchParams, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px' }}>
        {status === 'loading' && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Linking your account...
          </p>
        )}
        {status === 'success' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '28px', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
              You're in.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              Redirecting to your dashboard...
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '28px', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
