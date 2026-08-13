import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The moment planning begins.
 *
 * Onboarding used to end with a silent navigate('/') — the couple answered four
 * screens of questions and got dropped onto a dashboard with no acknowledgement.
 * This is the first of the milestone celebrations in EXPERIENCE-SPEC.md §4.
 *
 * Confetti is CSS-only (no dependency) and the pieces are a fixed list rather
 * than randomised, so nothing impure runs during render.
 */

type Piece = { left: number; delay: number; duration: number; color: string; size: number; rotate: number }

// Gold, sage and taupe per the Warm Editorial palette — no primary colours.
const CONFETTI: Piece[] = [
  { left:  4, delay: 0.00, duration: 3.4, color: '#B8926A', size:  9, rotate:  20 },
  { left: 11, delay: 0.55, duration: 4.1, color: '#7B8F6B', size:  7, rotate: -35 },
  { left: 18, delay: 0.20, duration: 3.7, color: '#D4CFC8', size: 10, rotate:  65 },
  { left: 25, delay: 0.95, duration: 4.4, color: '#B8926A', size:  6, rotate: -15 },
  { left: 32, delay: 0.35, duration: 3.2, color: '#C4A5A8', size:  8, rotate:  45 },
  { left: 39, delay: 1.15, duration: 4.0, color: '#7B8F6B', size:  9, rotate: -50 },
  { left: 46, delay: 0.10, duration: 3.9, color: '#B8926A', size:  7, rotate:  30 },
  { left: 53, delay: 0.75, duration: 3.5, color: '#E8E2D8', size: 11, rotate: -25 },
  { left: 60, delay: 0.45, duration: 4.3, color: '#B8926A', size:  8, rotate:  55 },
  { left: 67, delay: 1.30, duration: 3.6, color: '#7B8F6B', size:  6, rotate: -40 },
  { left: 74, delay: 0.25, duration: 4.2, color: '#C4A5A8', size:  9, rotate:  15 },
  { left: 81, delay: 0.85, duration: 3.3, color: '#D4CFC8', size:  7, rotate: -60 },
  { left: 88, delay: 0.60, duration: 4.5, color: '#B8926A', size: 10, rotate:  35 },
  { left: 95, delay: 1.05, duration: 3.8, color: '#7B8F6B', size:  8, rotate: -20 },
]

export default function WelcomeCelebration({
  coupleName, daysUntil, weddingDate, onDismiss,
}: {
  coupleName: string
  daysUntil: number | null
  weddingDate: string | null
  onDismiss: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  function dismiss() {
    setLeaving(true)
    window.setTimeout(onDismiss, 320)
  }

  // Escape should always get you out of a full-screen overlay.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formattedDate = weddingDate
    ? new Date(`${weddingDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  // Portalled to <body>. Rendered inside AppShell it sat in that subtree's
  // stacking context, so the sidebar and right panel painted over the top of it.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Veil"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        overflow: 'hidden',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <style>{`
        @keyframes veil-confetti-fall {
          0%   { transform: translateY(-12vh) rotate(0deg);   opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
        @keyframes veil-welcome-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes veil-ring-draw {
          from { stroke-dashoffset: 289; }
          to   { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .veil-confetti-piece { display: none; }
          .veil-welcome-item, .veil-ring-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* Confetti */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            className="veil-confetti-piece"
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 1.6}px`,
              background: p.color,
              borderRadius: '2px',
              transform: `rotate(${p.rotate}deg)`,
              animation: `veil-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: '440px' }}>
        {/* Ring with heart */}
        <div className="veil-welcome-item" style={{ animation: 'veil-welcome-rise 0.6s ease both' }}>
          <svg width="96" height="96" viewBox="0 0 100 100" style={{ marginBottom: '24px' }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-border)" strokeWidth="2" />
            <circle
              className="veil-ring-anim"
              cx="50" cy="50" r="46" fill="none"
              stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="289"
              transform="rotate(-90 50 50)"
              style={{ animation: 'veil-ring-draw 1.4s ease-out 0.3s both' }}
            />
            <path
              d="M50 62 L38 50.5 a7.5 7.5 0 1 1 12-8.6 a7.5 7.5 0 1 1 12 8.6 Z"
              fill="var(--color-accent)"
            />
          </svg>
        </div>

        <p
          className="veil-welcome-item"
          style={{
            fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--color-text-secondary)',
            margin: '0 0 10px 0', fontWeight: 600,
            animation: 'veil-welcome-rise 0.6s ease 0.15s both',
          }}
        >
          Let the planning begin
        </p>

        <h1
          className="veil-welcome-item"
          style={{
            fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 400,
            color: 'var(--color-text-primary)', margin: '0 0 14px 0', lineHeight: 1.15,
            animation: 'veil-welcome-rise 0.6s ease 0.3s both',
          }}
        >
          {coupleName || 'Your wedding'}
        </h1>

        {daysUntil !== null && daysUntil >= 0 && (
          <p
            className="veil-welcome-item"
            style={{
              fontFamily: 'var(--font-body)', fontSize: '16px',
              color: 'var(--color-text-secondary)', margin: '0 0 6px 0',
              animation: 'veil-welcome-rise 0.6s ease 0.45s both',
            }}
          >
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', color: 'var(--color-accent)' }}>
              {daysUntil.toLocaleString()}
            </span>
            {' '}days to go
          </p>
        )}

        {formattedDate && (
          <p
            className="veil-welcome-item"
            style={{
              fontFamily: 'var(--font-body)', fontSize: '13px',
              color: 'var(--color-text-muted)', margin: '0 0 32px 0',
              animation: 'veil-welcome-rise 0.6s ease 0.55s both',
            }}
          >
            {formattedDate}
          </p>
        )}

        <div className="veil-welcome-item" style={{ animation: 'veil-welcome-rise 0.6s ease 0.7s both' }}>
          <button
            type="button"
            onClick={dismiss}
            autoFocus
            style={{
              padding: '15px 34px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Start planning →
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
