import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { track } from '../lib/analytics'
import type { Couple } from '../types/database'

type TimelineResult = {
  overall_status: 'On Track' | 'At Risk' | 'Behind'
  summary: string
  urgent: { item: string; reason: string }[]
  on_track: string[]
  watch_list: { item: string; when: string }[]
}

const statusColors: Record<string, string> = {
  'On Track': 'var(--color-status-booked)',
  'At Risk': 'var(--color-status-short)',
  'Behind': '#C4785C',
}

type PhaseInfo = {
  id: string
  label: string
  monthsFrom: number  // months before wedding (start of range)
  monthsTo: number    // months before wedding (end of range)
  tasks: string[]
}

const PHASES: PhaseInfo[] = [
  {
    id: '12plus',
    label: '12+ months out',
    monthsFrom: 12,
    monthsTo: 36,
    tasks: [
      'Set a total wedding budget',
      'Choose your wedding date',
      'Estimate guest count',
      'Research and book your venue',
      'Consider hiring a wedding planner',
    ],
  },
  {
    id: '9to12',
    label: '9–12 months out',
    monthsFrom: 9,
    monthsTo: 12,
    tasks: [
      'Send save-the-dates',
      'Book photographer & videographer',
      'Book caterer (or confirm venue catering)',
      'Book florist',
      'Book band or DJ',
      'Start dress / attire shopping',
    ],
  },
  {
    id: '6to9',
    label: '6–9 months out',
    monthsFrom: 6,
    monthsTo: 9,
    tasks: [
      'Book officiant',
      'Book hair & makeup artists',
      'Book transportation',
      'Start planning honeymoon',
      'Finalize wedding party',
    ],
  },
  {
    id: '3to6',
    label: '3–6 months out',
    monthsFrom: 3,
    monthsTo: 6,
    tasks: [
      'Send formal invitations (8–10 weeks before)',
      'Register for gifts',
      'Schedule menu tasting with caterer',
      'Order wedding cake',
      'Plan rehearsal dinner',
      'Arrange accommodations for out-of-town guests',
    ],
  },
  {
    id: '1to3',
    label: '1–3 months out',
    monthsFrom: 1,
    monthsTo: 3,
    tasks: [
      'Confirm all vendor bookings',
      'Obtain marriage license',
      'Final dress / suit fitting',
      'Create seating chart',
      'Write vows',
      'Book honeymoon flights & hotel (if not done)',
    ],
  },
  {
    id: 'weekof',
    label: 'Week of the wedding',
    monthsFrom: 0,
    monthsTo: 1,
    tasks: [
      'Confirm day-of timeline with all vendors',
      'Final headcount to caterer',
      'Pack for honeymoon',
      'Prepare emergency kit (safety pins, stain pen, mints)',
      'Enjoy your rehearsal dinner',
    ],
  },
]

function monthsBefore(weddingDate: Date, months: number): string {
  const d = new Date(weddingDate)
  d.setMonth(d.getMonth() - months)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getCurrentPhaseId(weddingDate: Date): string {
  const now = new Date()
  const diffMs = weddingDate.getTime() - now.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  if (diffMonths >= 12) return '12plus'
  if (diffMonths >= 9) return '9to12'
  if (diffMonths >= 6) return '6to9'
  if (diffMonths >= 3) return '3to6'
  if (diffMonths >= 0) return '1to3'
  return 'weekof'
}

export default function Timeline() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const c = await getCoupleForUser(user.id)
        if (c) setCouple(c)
      } catch {
        // silent
      } finally {
        setPageLoading(false)
      }
    }
    init()
  }, [])

  async function checkTimeline() {
    if (!couple) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('planning-timeline', {
        body: { couple_id: couple.id },
      })
      if (fnError) throw fnError
      setResult(data)
      track('timeline_checked', { overall_status: data.overall_status })
    } catch {
      setError("Couldn't generate AI analysis — try again")
    } finally {
      setLoading(false)
    }
  }

  const weddingDate = couple?.wedding_date ? new Date(couple.wedding_date + 'T12:00:00') : null
  const currentPhaseId = weddingDate ? getCurrentPhaseId(weddingDate) : null

  if (pageLoading) {
    return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '640px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>
            Planning Timeline
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {weddingDate
              ? `Wedding on ${weddingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${currentPhaseId === 'weekof' ? "It's almost time!" : `You're in the ${PHASES.find(p => p.id === currentPhaseId)?.label} phase`}`
              : 'Add your wedding date in Settings to see personalized timelines'}
          </div>
        </div>

        {/* AI Analysis result — if run */}
        {result && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 16px', borderRadius: '20px', border: `1.5px solid ${statusColors[result.overall_status]}`, background: `${statusColors[result.overall_status]}15`, marginBottom: '14px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: statusColors[result.overall_status], margin: 0, fontWeight: 600 }}>
                AI Assessment: {result.overall_status}
              </p>
            </div>

            <Card style={{ marginBottom: '12px' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontStyle: 'italic', lineHeight: 1.65, margin: 0, color: 'var(--color-text-primary)' }}>
                {result.summary}
              </p>
            </Card>

            {result.urgent.length > 0 && (
              <Card style={{ marginBottom: '12px', borderColor: 'rgba(196,120,92,0.3)' }}>
                <SectionLabel>Urgent — Next 4 Weeks</SectionLabel>
                {result.urgent.map((item, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: '#C4785C', margin: '0 0 2px 0' }}>{item.item}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{item.reason}</p>
                  </div>
                ))}
              </Card>
            )}

            {result.watch_list.length > 0 && (
              <Card style={{ marginBottom: '12px' }}>
                <SectionLabel>Watch List</SectionLabel>
                {result.watch_list.map((item, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-bg)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>{item.item}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{item.when}</p>
                  </div>
                ))}
              </Card>
            )}

            {result.on_track.length > 0 && (
              <Card style={{ marginBottom: '12px' }}>
                <SectionLabel>On Track</SectionLabel>
                {result.on_track.map((item, i) => (
                  <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-status-booked)', margin: '0 0 4px 0' }}>
                    ✓ {item}
                  </p>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Static milestone phases */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {PHASES.map((phase, phaseIdx) => {
            const isCurrent = phase.id === currentPhaseId
            const isPast = weddingDate
              ? PHASES.findIndex(p => p.id === currentPhaseId) > phaseIdx
              : false

            return (
              <div
                key={phase.id}
                style={{
                  border: isCurrent ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  background: isCurrent ? 'rgba(184,146,106,0.05)' : '#fff',
                  opacity: isPast ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-body)',
                      color: isCurrent ? 'var(--color-accent)' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    }}>
                      {phase.label}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', background: 'var(--color-accent)',
                        color: '#fff', padding: '2px 7px', borderRadius: '6px',
                      }}>
                        Now
                      </span>
                    )}
                    {isPast && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Done</span>
                    )}
                  </div>
                  {weddingDate && phase.id !== 'weekof' && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                      By {monthsBefore(weddingDate, phase.monthsFrom)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {phase.tasks.map((task, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '14px', height: '14px', flexShrink: 0, marginTop: '2px',
                        borderRadius: '50%',
                        border: isPast ? '2px solid var(--color-status-booked)' : `2px solid ${isCurrent ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: isPast ? 'var(--color-status-booked)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '8px', fontWeight: 700,
                      }}>
                        {isPast ? '✓' : ''}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '13px',
                        color: isPast ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                        textDecoration: isPast ? 'line-through' : 'none',
                        lineHeight: 1.4,
                      }}>
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* AI analysis CTA */}
        <div style={{ marginTop: '24px', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fdfaf7' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Get a personalized AI assessment
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            Based on your wedding date, booked vendors, and overall progress — see what's on track, what's urgent, and what to watch.
          </div>
          {error && <p style={{ color: '#C4785C', fontFamily: 'var(--font-body)', fontSize: '12px', marginBottom: '10px', margin: '0 0 10px 0' }}>{error}</p>}
          <Button onClick={checkTimeline} disabled={loading || !couple}>
            {loading ? 'Analyzing...' : result ? 'Refresh AI Analysis' : 'Check My Timeline'}
          </Button>
        </div>

      </div>
    </AppShell>
  )
}
