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
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.07)',
        padding: '24px',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
