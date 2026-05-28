import React from 'react'

type Segment = {
  value: number
  color: string
  label?: string
}

type MultiSegmentRingProps = {
  data: Segment[]
  totalValue?: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}

// Multi-slice SVG donut ring — no dependencies
// segments: [{value, color, label}], optional totalValue for partially-filled ring
// Centers children inside the ring via absolute positioning
// Falls back to a uniform gray ring when total === 0
export function MultiSegmentRing({
  data,
  totalValue,
  size = 160,
  strokeWidth = 22,
  children,
}: MultiSegmentRingProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2
  const total = totalValue ?? data.reduce((sum, s) => sum + s.value, 0)

  // Build per-segment dasharray/dashoffset values
  // Formula: dashoffset = circ - priorLen places each segment right after the previous
  let priorLen = 0
  const segments = total > 0
    ? data.filter(s => s.value > 0).map(s => {
        const arcLen = (s.value / total) * circ
        const dashLen = Math.max(0, arcLen - 1.5) // 1.5px visual gap between segments
        const dashGap = Math.max(0, circ - dashLen)
        const offset = circ - priorLen
        priorLen += arcLen
        return { color: s.color, dashLen, dashGap, offset }
      })
    : []

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDE8E1" strokeWidth={strokeWidth} />
        {/* Colored segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLen} ${seg.dashGap}`}
            strokeDashoffset={seg.offset}
          />
        ))}
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
