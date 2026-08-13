import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { STEP_LABELS, STEP_COUNT, type StepNumber } from './steps'

/**
 * Shared chrome for the onboarding flow.
 *
 * Previously StepIndicator was copy-pasted identically into every step file,
 * which meant adding a step required editing it in N places. It lives here now.
 */


export function StepIndicator({ current }: { current: StepNumber }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              height: '3px',
              flex: 1,
              borderRadius: '2px',
              background: i + 1 <= current ? 'var(--color-accent)' : 'var(--color-border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: i + 1 === current ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontWeight: i + 1 === current ? 600 : 400,
              transition: 'color 0.2s',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Back link. Onboarding previously had no way to correct an earlier answer. */
export function BackLink({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--color-text-secondary)',
        fontSize: '13px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}
    >
      <span aria-hidden>←</span> Back
    </button>
  )
}

/** Page shell: full-height warm background, fixed logo, centred column. */
export function OnboardingShell({
  children, maxWidth = '460px',
}: { children: ReactNode; maxWidth?: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ position: 'fixed', top: 24, left: 28 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-accent)', letterSpacing: '0.02em' }}>
          Veil
        </span>
      </div>
      <div style={{ width: '100%', maxWidth }}>{children}</div>
    </div>
  )
}

export function Eyebrow({ current }: { current: StepNumber }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
      Step {current} of {STEP_COUNT}
    </p>
  )
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.2 }}>
      {children}
    </h1>
  )
}

export function Subtitle({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', margin: '0 0 36px 0' }}>
      {children}
    </p>
  )
}

export function PrimaryButton({
  onClick, disabled, children,
}: { onClick: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        border: 'none',
        background: disabled ? 'var(--color-border)' : 'var(--color-accent)',
        color: disabled ? 'var(--color-text-muted)' : '#fff',
        fontSize: '15px',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}


