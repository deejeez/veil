import type { VendorStatus } from '../types/database'

type BadgeStyle = { bg: string; text: string }

const badgeStyles: Record<VendorStatus, BadgeStyle> = {
  not_started:       { bg: '#EDEAE6', text: '#8A8179' },
  researching:       { bg: '#E2EAF0', text: '#5A7A8F' },
  shortlisted:       { bg: '#F0E8DC', text: '#8B6F4E' },
  meeting_scheduled: { bg: '#F0E8DC', text: '#8B6F4E' },
  in_contract:       { bg: '#EDF2E8', text: '#6B8A5A' },
  booked:            { bg: '#E8F0E4', text: '#5A7A4A' },
  eliminated:        { bg: '#EDEAE6', text: '#8A8179' },
}

const labels: Record<VendorStatus, string> = {
  not_started:       'To Do',
  researching:       'Researching',
  shortlisted:       'Shortlisted',
  meeting_scheduled: 'Meeting Set',
  in_contract:       'In Contract',
  booked:            'Booked',
  eliminated:        'Eliminated',
}

export default function StatusBadge({ status }: { status: VendorStatus | string }) {
  const safeStatus = (status as VendorStatus) in badgeStyles ? (status as VendorStatus) : 'not_started'
  const { bg, text } = badgeStyles[safeStatus]
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: text,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        padding: '3px 8px',
        borderRadius: '6px',
        textDecoration: safeStatus === 'eliminated' ? 'line-through' : 'none',
        opacity: safeStatus === 'eliminated' ? 0.7 : 1,
      }}
    >
      {labels[safeStatus] ?? status}
    </span>
  )
}
