import { type CSSProperties, type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export default function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
