import type { CSSProperties, ReactNode } from 'react'

interface GlowBorderProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}

export default function GlowBorder({ children, style, onClick }: GlowBorderProps) {
  return (
    <>
      <style>{`
        @keyframes shimmer-border {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .glow-wrapper {
          position: relative;
          padding: 2px;
          border-radius: 14px;
          background: linear-gradient(
            90deg,
            #D4CFC8 0%,
            #D4CFC8 35%,
            #B8926A 45%,
            #D4A574 50%,
            #C4785C 55%,
            #D4CFC8 65%,
            #D4CFC8 100%
          );
          background-size: 300% 100%;
          animation: shimmer-border 8s ease-in-out infinite;
        }
      `}</style>
      <div className="glow-wrapper" style={style} onClick={onClick}>
        {children}
      </div>
    </>
  )
}
