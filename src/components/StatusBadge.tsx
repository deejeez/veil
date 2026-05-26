import type { VendorStatus } from '../types/database'

const colors: Record<VendorStatus, string> = {
  booked: 'var(--color-status-booked)',
  shortlisted: 'var(--color-status-short)',
  not_started: 'var(--color-status-none)',
}

const labels: Record<VendorStatus, string> = {
  booked: 'Booked',
  shortlisted: 'Shortlisted',
  not_started: 'Not Started',
}

export default function StatusBadge({ status }: { status: VendorStatus }) {
  return (
    <span
      style={{
        color: colors[status],
        fontSize: '11px',
        letterSpacing: '0.04em',
        fontFamily: 'var(--font-body)',
      }}
    >
      {labels[status]}
    </span>
  )
}
