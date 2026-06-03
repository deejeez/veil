import { useNavigate } from 'react-router-dom'
import GlowBorder from './GlowBorder'

interface AiAdvisorCardProps {
  text: string | null
  loading?: boolean
}

export default function AiAdvisorCard({ text, loading = false }: AiAdvisorCardProps) {
  const navigate = useNavigate()

  return (
    <GlowBorder
      onClick={() => navigate('/timeline')}
      style={{ marginTop: '20px', cursor: 'pointer' }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '14px 16px',
          borderRadius: '12px',
          background: '#F5F1EC',
          transition: 'background 200ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#EDE8E1')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F5F1EC')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          >
            AI Advisor
          </p>
          <span style={{ fontSize: '11px', color: 'rgba(184,146,106,0.5)', lineHeight: 1 }}>→</span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '12px',
            color: '#6B5E54',
            lineHeight: 1.6,
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          {loading ? 'Thinking...' : (text ?? 'Add your wedding date to get personalized planning guidance.')}
        </p>
      </div>
    </GlowBorder>
  )
}
