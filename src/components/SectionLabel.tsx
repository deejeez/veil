import { type ReactNode } from 'react'

export default function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '9px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        margin: '0 0 8px 0',
      }}
    >
      {children}
    </p>
  )
}
