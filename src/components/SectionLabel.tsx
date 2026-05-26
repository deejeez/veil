import { type ReactNode } from 'react'

export default function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        margin: '0 0 10px 0',
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  )
}
