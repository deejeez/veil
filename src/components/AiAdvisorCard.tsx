interface AiAdvisorCardProps {
  text: string | null
  loading?: boolean
}

export default function AiAdvisorCard({ text, loading = false }: AiAdvisorCardProps) {
  return (
    <div
      style={{
        marginTop: '20px',
        padding: '10px',
        border: '1px solid rgba(200,169,110,0.3)',
        background: 'rgba(200,169,110,0.08)',
      }}
    >
      <p
        style={{
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          margin: '0 0 5px 0',
          fontFamily: 'var(--font-body)',
        }}
      >
        AI Advisor
      </p>
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          color: '#D4C4B0',
          lineHeight: 1.5,
          fontStyle: 'italic',
          margin: 0,
        }}
      >
        {loading ? 'Thinking...' : (text ?? 'Add your wedding details to get started.')}
      </p>
    </div>
  )
}
