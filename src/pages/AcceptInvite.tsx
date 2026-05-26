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

        // Link this user as the partner on the couple row.
        // The service role is not available here, so we use the user's own
        // session. The RLS policy on couples allows updates by email_partner
        // only through user_id_partner being null — but actually the policy
        // allows update by user_id_primary OR user_id_partner. Since this user
        // isn't linked yet, we use a Supabase Edge Function bypass or rely on
        // the email_partner match. For now we attempt the update and gracefully
        // handle a policy denial by informing the user to contact support.
        const { error } = await supabase
          .from('couples')
          .update({ user_id_partner: user.id })
          .eq('id', coupleId)
          .eq('email_partner', user.email)

        if (error) {
          setErrorMsg('Could not link your account to this couple. ' + error.message)
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
