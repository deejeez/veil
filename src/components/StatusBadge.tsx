import type { VendorStatus } from '../types/database'

const colors: Record<VendorStatus, string> = {
  not_started: 'var(--color-status-none)',
  researching: '#5B8DB8',
  shortlisted: 'var(--color-status-short)',
  meeting_scheduled: '#8B5CF6',
  booked: 'var(--color-status-booked)',
  eliminated: '#B0A090',
}

const labels: Record<VendorStatus, string> = {
  not_started: 'Not Started',
  researching: 'Researching',
  shortlisted: 'Shortlisted',
  meeting_scheduled: 'Meeting Scheduled',
  booked: 'Booked',
  eliminated: 'Eliminated',
}

export default function StatusBadge({ status }: { status: VendorStatus | string }) {
  const safeStatus = (status as VendorStatus) in colors ? (status as VendorStatus) : 'not_started'
  return (
    <span
      style={{
        color: colors[safeStatus],
        fontSize: '11px',
        letterSpacing: '0.04em',
        fontFamily: 'var(--font-body)',
        textDecoration: safeStatus === 'eliminated' ? 'line-through' : 'none',
        opacity: safeStatus === 'eliminated' ? 0.7 : 1,
      }}
    >
      {labels[safeStatus] ?? status}
    </span>
  )
}
