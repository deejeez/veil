import type { CSSProperties, ReactNode } from 'react'

interface GlowBorderProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  borderRadius?: number
  padding?: number
}

export default function GlowBorder({ children, style, onClick, borderRadius = 14, padding = 2 }: GlowBorderProps) {
  return (
    <>
      <style>{`
        @keyframes rainbow-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .glow-wrapper {
          position: relative;
          overflow: hidden;
        }
        .glow-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            #ff6b6b 10%,
            #ff8e53 20%,
            #ffd700 35%,
            #7ecf7e 50%,
            #5bb5f0 65%,
            #a78bfa 80%,
            #f472b6 90%,
            transparent 100%
          );
          animation: rainbow-sweep 6s ease-in-out infinite;
          z-index: 0;
        }
        .glow-wrapper > .glow-inner {
          position: relative;
          z-index: 1;
        }
      `}</style>
      <div
        className="glow-wrapper"
        style={{ borderRadius: `${borderRadius}px`, padding: `${padding}px`, ...style }}
        onClick={onClick}
      >
        <div className="glow-inner" style={{ borderRadius: `${borderRadius - padding}px` }}>
          {children}
        </div>
      </div>
    </>
  )
}
