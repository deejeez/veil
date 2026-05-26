import { useNavigate } from 'react-router-dom'

interface AiAdvisorCardProps {
  text: string | null
  loading?: boolean
}

export default function AiAdvisorCard({ text, loading = false }: AiAdvisorCardProps) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate('/timeline')}
      style={{
        marginTop: '20px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(196,120,138,0.25)',
        background: 'rgba(196,120,138,0.08)',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,120,138,0.14)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(196,120,138,0.08)')}
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
        <span style={{ fontSize: '11px', color: 'rgba(196,120,138,0.5)', lineHeight: 1 }}>→</span>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '12px',
          color: '#C8B8C0',
          lineHeight: 1.6,
          fontStyle: 'italic',
          margin: 0,
        }}
      >
        {loading ? 'Thinking...' : (text ?? 'Add your wedding details to get started.')}
      </p>
    </div>
  )
}
