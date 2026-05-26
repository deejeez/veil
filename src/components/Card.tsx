import { type CSSProperties, type MouseEventHandler, type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLDivElement>
}

export default function Card({ children, className = '', style, onClick }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: '16px',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
