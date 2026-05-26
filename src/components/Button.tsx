import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const styles: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: '#1A1208',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1.5px solid var(--color-border)',
    borderRadius: '10px',
    padding: '12px 24px',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-accent)',
    border: 'none',
    padding: '6px 0',
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}

export default function Button({ variant = 'primary', children, style, ...props }: ButtonProps) {
  return (
    <button style={{ ...styles[variant], ...style }} {...props}>
      {children}
    </button>
  )
}
