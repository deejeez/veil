import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { marked } from 'marked'
import privacyMd from '../content/legal/privacy-policy.md?raw'
import termsMd from '../content/legal/terms-of-service.md?raw'

const DOCS = {
  privacy: { md: privacyMd, title: 'Privacy Policy' },
  terms: { md: termsMd, title: 'Terms of Service' },
} as const

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const { md, title } = DOCS[doc]
  // Source markdown is our own checked-in legal copy, not user input.
  const html = useMemo(() => marked.parse(md, { async: false }), [md])

  useEffect(() => {
    document.title = `${title} · Veil`
    window.scrollTo(0, 0)
    return () => { document.title = 'Veil' }
  }, [title])

  return (
    <div className="page-fade-in" style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <a href="https://getwed.ai" style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-accent)', letterSpacing: '0.04em', textDecoration: 'none' }}>
          Veil
        </a>
        <div className="legal-prose" dangerouslySetInnerHTML={{ __html: html }} />
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '20px', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
          <Link to="/privacy" style={{ color: doc === 'privacy' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: doc === 'terms' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
          <Link to="/login" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', marginLeft: 'auto' }}>Log in</Link>
        </div>
      </div>
    </div>
  )
}
