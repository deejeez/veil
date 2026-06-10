import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { track } from '../lib/analytics'
import type { Couple } from '../types/database'

const ChatPanel = lazy(() => import('./ChatPanel'))

const EXCLUDED_PREFIXES = [
  '/login',
  '/signup',
  '/onboarding',
  '/paywall',
  '/payment-success',
  '/reset-password',
  '/demo',
  '/accept-invite',
]

function clearChatHistory() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('veil_chat_'))
      .forEach(k => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

export default function ChatAssistant() {
  const { pathname } = useLocation()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [open, setOpen] = useState(false)
  const [panelLoaded, setPanelLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setCouple(null)
        return
      }
      const c = await getCoupleForUser(user.id)
      if (mounted) setCouple(c)
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        clearChatHistory()
        setCouple(null)
        setOpen(false)
        setPanelLoaded(false)
      } else if (event === 'SIGNED_IN') {
        load()
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const excluded = EXCLUDED_PREFIXES.some(p => pathname.startsWith(p))
  const eligible = couple && couple.paid && (couple.onboarding_complete || couple.wedding_date)
  if (excluded || !eligible) return null

  function toggle() {
    if (!open) {
      setPanelLoaded(true)
      track('chat_opened')
    }
    setOpen(o => !o)
  }

  return (
    <>
      {panelLoaded && (
        <Suspense fallback={null}>
          <ChatPanel coupleId={couple.id} open={open} onMinimize={() => setOpen(false)} />
        </Suspense>
      )}

      {/* On mobile the panel is anchored to the bottom edge and would sit under the bubble,
          so the bubble hides while open (header X closes instead). */}
      <style>{`
        @media (max-width: 640px) {
          .veil-chat-bubble.veil-chat-bubble-open { display: none !important; }
        }
      `}</style>
      <button
        onClick={toggle}
        aria-label={open ? 'Close chat' : 'Chat with your wedding planner'}
        className={`veil-chat-bubble${open ? ' veil-chat-bubble-open' : ''}`}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#C9A96E',
          border: 'none',
          cursor: 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(201,169,110,0.3)',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(201,169,110,0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,169,110,0.3)'
        }}
      >
        {/* Sparkle icon — fades/rotates out when open */}
        <svg
          width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: 'absolute',
            transition: 'opacity 200ms ease, transform 200ms ease',
            opacity: open ? 0 : 1,
            transform: open ? 'rotate(90deg) scale(0.6)' : 'rotate(0deg) scale(1)',
          }}
        >
          <path d="M12 3l1.9 5.7a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>
        </svg>
        {/* X icon — fades/rotates in when open */}
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="2" strokeLinecap="round"
          style={{
            position: 'absolute',
            transition: 'opacity 200ms ease, transform 200ms ease',
            opacity: open ? 1 : 0,
            transform: open ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.6)',
          }}
        >
          <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
        </svg>
      </button>
    </>
  )
}
