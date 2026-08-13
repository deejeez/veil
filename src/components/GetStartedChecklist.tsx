import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChecklistStep } from '../lib/getStartedSteps'

/**
 * First-run orientation.
 *
 * A new couple lands on a dashboard with nine nav items and mostly empty
 * modules. A one-shot tooltip tour would answer "where is everything" once and
 * then be gone; this answers it every time they come back, and each item is a
 * real next action rather than a label pointing at a menu.
 *
 * Disappears on its own once everything is done, so it doesn't become
 * permanent furniture.
 */


export default function GetStartedChecklist({ steps }: { steps: ChecklistStep[] }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('veil_getstarted_dismissed') === '1'
  )

  const doneCount = steps.filter(s => s.done).length
  // Nothing left to guide them through, or they've opted out.
  if (dismissed || doneCount === steps.length) return null

  const nextStep = steps.find(s => !s.done)

  function dismiss() {
    localStorage.setItem('veil_getstarted_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(140,120,100,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '19px', fontWeight: 400, color: 'var(--color-text-primary)', margin: 0 }}>
          Getting started
        </h2>
        <button
          type="button"
          onClick={dismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', padding: '2px 4px' }}
        >
          Hide
        </button>
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 14px 0' }}>
        {doneCount === 0
          ? 'Five things that make everything else easier.'
          : `${doneCount} of ${steps.length} done${nextStep ? ` — ${nextStep.title.toLowerCase()} is next.` : '.'}`}
      </p>

      {/* Progress */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px' }}>
        {steps.map(s => (
          <div
            key={s.key}
            style={{
              height: '3px', flex: 1, borderRadius: '2px',
              background: s.done ? 'var(--color-secondary-accent, #7B8F6B)' : 'var(--color-border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {steps.map(step => (
          <button
            key={step.key}
            type="button"
            onClick={() => navigate(step.path)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%',
              background: 'none', border: 'none', borderRadius: '8px',
              padding: '10px 8px', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.15s',
              opacity: step.done ? 0.55 : 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F5F1EC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span
              aria-hidden
              style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                border: step.done ? 'none' : '1.5px solid var(--color-border)',
                background: step.done ? '#7B8F6B' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {step.done && (
                <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500,
                color: 'var(--color-text-primary)',
                textDecoration: step.done ? 'line-through' : 'none',
              }}>
                {step.title}
              </span>
              {!step.done && (
                <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {step.blurb}
                </span>
              )}
            </span>
            {!step.done && (
              <span aria-hidden style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', flexShrink: 0, marginTop: '1px' }}>→</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
