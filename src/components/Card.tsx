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
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(140,120,100,0.08), 0 4px 12px rgba(140,120,100,0.05)',
        padding: '24px',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
