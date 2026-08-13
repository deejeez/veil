import { Component, type ReactNode, type ErrorInfo } from 'react'
import { track } from '../lib/analytics'

/**
 * Catches render errors anywhere below it.
 *
 * Without this, any component that throws unmounts the whole tree and the user
 * is left staring at a blank white page with no message and no way back — which
 * on a paid product reads as the site being down.
 *
 * Must be a class: there is no hook equivalent of componentDidCatch.
 */

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in PostHog so these are visible without the user reporting them.
    track('app_error', {
      message: error.message,
      stack: error.stack?.slice(0, 2000),
      componentStack: info.componentStack?.slice(0, 2000),
      path: window.location.pathname,
    })
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-accent)', margin: '0 0 24px 0', letterSpacing: '0.02em' }}>
            Veil
          </p>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 12px 0', lineHeight: 1.25 }}>
            Something went wrong on our end
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-text-secondary)', margin: '0 0 28px 0', lineHeight: 1.6 }}>
            Your planning is safe — nothing was lost. Reloading usually sorts it.
            If it keeps happening, email{' '}
            <a href="mailto:hello@getwed.ai" style={{ color: 'var(--color-accent)' }}>hello@getwed.ai</a>{' '}
            and we'll take a look.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '13px 26px', borderRadius: '10px', border: 'none',
                background: 'var(--color-accent)', color: '#fff',
                fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <button
              type="button"
              // Full navigation rather than router push: the router is part of
              // the tree that just failed, so it can't be trusted to recover.
              onClick={() => { window.location.href = '/' }}
              style={{
                padding: '13px 26px', borderRadius: '10px',
                border: '1.5px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: '14px', fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Back to home
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre style={{
              marginTop: '28px', textAlign: 'left', fontSize: '11px',
              color: 'var(--color-text-muted)', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: '8px',
              padding: '12px', overflow: 'auto', maxHeight: '220px',
            }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
