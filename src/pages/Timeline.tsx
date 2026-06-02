import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import GlowBorder from '../components/GlowBorder'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple } from '../lib/vendors'
import { getGuestsForCouple } from '../lib/guests'
import { getBudgetCategories } from '../lib/budget'
import { track } from '../lib/analytics'
import {
  deriveTimelineStatus,
  getCurrentPhaseId,
  buildDataFingerprint,
  type PhaseStatus,
  type MilestoneStatus,
} from '../lib/deriveTimelineStatus'
import type { Couple } from '../types/database'

type TimelineResult = {
  overall_status: 'On Track' | 'At Risk' | 'Behind'
  summary: string
  urgent: { item: string; reason: string }[]
  on_track: string[]
  watch_list: { item: string; when: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  'On Track': '#7B8F6B',
  'At Risk': '#B8926A',
  'Behind': '#C4785C',
}

const AI_CACHE_KEY = 'veil_timeline_assessment'
const AI_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

type CachedAssessment = {
  result: TimelineResult
  timestamp: number
  fingerprint: string
}

function loadCachedAssessment(): CachedAssessment | null {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedAssessment
  } catch {
    return null
  }
}

function saveCachedAssessment(result: TimelineResult, fingerprint: string) {
  const entry: CachedAssessment = { result, timestamp: Date.now(), fingerprint }
  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(entry))
}

function isCacheStale(cached: CachedAssessment, currentFingerprint: string): boolean {
  if (cached.fingerprint !== currentFingerprint) return true
  if (Date.now() - cached.timestamp > AI_CACHE_TTL_MS) return true
  return false
}

function monthsBefore(weddingDate: Date, months: number): string {
  const d = new Date(weddingDate)
  d.setMonth(d.getMonth() - months)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Map AI urgent/watchlist items to page links by keyword
function resolveItemLink(item: string): string | null {
  const lower = item.toLowerCase()
  if (lower.includes('venue')) return '/vendors/venue'
  if (lower.includes('photographer') || lower.includes('videographer')) return '/vendors/photographer'
  if (lower.includes('caterer') || lower.includes('catering')) return '/vendors/caterer'
  if (lower.includes('florist') || lower.includes('flower')) return '/vendors/florist'
  if (lower.includes('band') || lower.includes('dj') || lower.includes('music')) return '/vendors/band_dj'
  if (lower.includes('hair') || lower.includes('makeup')) return '/vendors/hair_makeup'
  if (lower.includes('transport')) return '/vendors/transportation'
  if (lower.includes('cake') || lower.includes('dessert')) return '/vendors/cake_desserts'
  if (lower.includes('invitation') || lower.includes('stationery')) return '/vendors/invitations_stationery'
  if (lower.includes('rehearsal dinner')) return '/vendors/rehearsal_dinner'
  if (lower.includes('hotel') || lower.includes('accommodation')) return '/vendors/hotels'
  if (lower.includes('wedding planner') || lower.includes('coordinator')) return '/vendors/wedding_planner'
  if (lower.includes('lighting')) return '/vendors/lighting'
  if (lower.includes('budget')) return '/budget'
  if (lower.includes('guest')) return '/guests'
  if (lower.includes('save-the-date') || lower.includes('invitation')) return '/guests'
  if (lower.includes('task') || lower.includes('to-do')) return '/todos'
  return null
}

// Circle indicator for milestone status
function MilestoneCircle({ status }: { status: MilestoneStatus }) {
  const baseStyle: React.CSSProperties = {
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '8px',
    fontWeight: 700,
    transition: 'all 0.15s ease',
  }

  if (status === 'done') {
    return (
      <div style={{ ...baseStyle, background: '#7B8F6B', border: '2px solid #7B8F6B', color: '#fff' }}>
        ✓
      </div>
    )
  }
  if (status === 'in_progress') {
    return (
      <div style={{ ...baseStyle, background: 'rgba(184,146,106,0.15)', border: '2px solid #B8926A' }} />
    )
  }
  return (
    <div style={{ ...baseStyle, background: 'transparent', border: '2px solid #D4CFC8' }} />
  )
}

// Single phase card — collapsed or expanded
function PhaseCard({
  phase,
  isCurrent,
  isPast,
  weddingDate,
  expanded,
  onToggle,
}: {
  phase: PhaseStatus
  isCurrent: boolean
  isPast: boolean
  weddingDate: Date | null
  expanded: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const allDone = phase.doneCount === phase.totalCount && phase.totalCount > 0

  return (
    <div
      style={{
        border: isCurrent ? '1.5px solid #B8926A' : '1px solid var(--color-border)',
        borderRadius: '12px',
        background: isCurrent ? 'rgba(184,146,106,0.04)' : '#fff',
        overflow: 'hidden',
        opacity: isPast && !expanded ? 0.6 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      {/* Phase header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: 700,
            color: isCurrent ? '#B8926A' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          }}>
            {phase.label}
          </span>

          {isCurrent && (
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', background: '#B8926A',
              color: '#fff', padding: '2px 7px', borderRadius: '6px', flexShrink: 0,
            }}>
              Now
            </span>
          )}

          {isPast && !isCurrent && (
            <span style={{ fontSize: '11px', color: '#7B8F6B', fontFamily: 'var(--font-body)' }}>
              ✓ Done
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Progress: "X/Y" badge */}
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: allDone ? '#7B8F6B' : 'var(--color-text-muted)',
            fontWeight: allDone ? 600 : 400,
          }}>
            {phase.doneCount}/{phase.totalCount}
          </span>

          {/* Date */}
          {weddingDate && phase.id !== 'weekof' && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
              by {monthsBefore(weddingDate, phase.monthsFrom)}
            </span>
          )}

          {/* Chevron */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Milestones list — shown when expanded */}
      {expanded && (
        <div style={{ padding: '0 16px 14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {phase.milestones.map((m, i) => {
            const isClickable = !!m.link
            return (
              <div
                key={i}
                onClick={() => m.link && navigate(m.link)}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  cursor: isClickable ? 'pointer' : 'default',
                  padding: isClickable ? '4px 6px 4px 0' : '2px 6px 2px 0',
                  borderRadius: '6px',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLElement).style.background = 'rgba(184,146,106,0.06)' }}
                onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <MilestoneCircle status={m.status} />
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  color: m.status === 'done'
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-primary)',
                  textDecoration: m.status === 'done' ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {m.task}
                </span>
                {isClickable && m.status !== 'done' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8926A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', opacity: 0.6 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Timeline() {
  const navigate = useNavigate()

  const [couple, setCouple] = useState<Couple | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  const [result, setResult] = useState<TimelineResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [phases, setPhases] = useState<PhaseStatus[]>([])
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

  const fingerprintRef = useRef<string>('')

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const c = await getCoupleForUser(user.id)
        if (!c) return
        setCouple(c)

        const [v, g, b] = await Promise.all([
          getVendorsForCouple(c.id),
          getGuestsForCouple(c.id),
          getBudgetCategories(c.id),
        ])
        // Derive phases from actual data
        const derived = deriveTimelineStatus(c, v, g, b)
        setPhases(derived)

        // Expand current phase by default
        const wDate = c.wedding_date ? new Date(c.wedding_date + 'T12:00:00') : null
        if (wDate) {
          const currentId = getCurrentPhaseId(wDate)
          setExpandedPhases(new Set([currentId]))
        }

        // Build fingerprint
        const fp = buildDataFingerprint(c, v, g, b)
        fingerprintRef.current = fp

        // Load cached AI assessment
        const cached = loadCachedAssessment()
        if (cached) {
          setResult(cached.result)
          // Silently re-fetch if stale
          if (isCacheStale(cached, fp)) {
            runAIAssessment(c.id, fp, true)
          }
        } else {
          // No cache — auto-fetch
          runAIAssessment(c.id, fp, false)
        }
      } catch {
        // silent
      } finally {
        setPageLoading(false)
      }
    }
    init()
  }, [])

  async function runAIAssessment(coupleId: string, fingerprint: string, silent: boolean) {
    if (!silent) setAiLoading(true)
    setAiError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('planning-timeline', {
        body: { couple_id: coupleId },
      })
      if (fnError) throw fnError
      setResult(data)
      saveCachedAssessment(data, fingerprint)
      track('timeline_checked', { overall_status: data.overall_status })
    } catch {
      if (!silent) setAiError("Couldn't generate AI analysis — try again")
    } finally {
      if (!silent) setAiLoading(false)
    }
  }

  function handleRefresh() {
    if (!couple) return
    runAIAssessment(couple.id, fingerprintRef.current, false)
  }

  function togglePhase(id: string) {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const weddingDate = couple?.wedding_date ? new Date(couple.wedding_date + 'T12:00:00') : null
  const currentPhaseId = weddingDate ? getCurrentPhaseId(weddingDate) : null

  const PHASE_ORDER = ['12plus', '9to12', '6to9', '3to6', '1to3', 'weekof']
  const currentPhaseIdx = currentPhaseId ? PHASE_ORDER.indexOf(currentPhaseId) : -1

  if (pageLoading) {
    return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '660px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>
            Planning Timeline
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {weddingDate
              ? `Wedding on ${weddingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${currentPhaseId === 'weekof' ? "It's almost time!" : `You're in the ${phases.find(p => p.id === currentPhaseId)?.label} phase`}`
              : 'Add your wedding date in Settings to see personalized timelines'}
          </div>
        </div>

        {/* AI Assessment — always visible, auto-loaded */}
        <GlowBorder style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative', zIndex: 1, borderRadius: '12px', background: '#F5F1EC', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: result ? '10px' : 0, gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#B8926A', margin: '0 0 4px 0', fontFamily: 'var(--font-body)', fontWeight: 600,
                }}>
                  AI Advisor
                </p>

                {aiLoading && !result && (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', margin: 0 }}>
                    Analyzing your timeline...
                  </p>
                )}

                {!aiLoading && !result && !aiError && (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', margin: 0 }}>
                    {couple ? 'Preparing your personalized assessment...' : 'Add your wedding details in Settings to get started.'}
                  </p>
                )}

                {result && (
                  <>
                    {/* Status pill */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 10px', borderRadius: '20px', marginBottom: '8px',
                      border: `1.5px solid ${STATUS_COLORS[result.overall_status]}`,
                      background: `${STATUS_COLORS[result.overall_status]}18`,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '10px',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: STATUS_COLORS[result.overall_status], fontWeight: 700,
                      }}>
                        {result.overall_status}
                      </span>
                    </div>

                    {/* Summary */}
                    <p style={{
                      fontFamily: 'var(--font-heading)', fontSize: '13.5px',
                      fontStyle: 'italic', lineHeight: 1.65, margin: 0,
                      color: 'var(--color-text-primary)',
                    }}>
                      {result.summary}
                    </p>
                  </>
                )}

                {aiError && (
                  <p style={{ color: '#C4785C', fontFamily: 'var(--font-body)', fontSize: '12px', margin: '4px 0 0 0' }}>
                    {aiError}
                  </p>
                )}
              </div>

              {/* Refresh button — subtle */}
              {(result || aiError) && (
                <button
                  onClick={handleRefresh}
                  disabled={aiLoading || !couple}
                  style={{
                    flexShrink: 0,
                    fontSize: '11px', fontWeight: 600, padding: '5px 12px',
                    borderRadius: '7px', border: '1px solid rgba(184,146,106,0.3)',
                    background: 'transparent', color: '#B8926A',
                    cursor: aiLoading || !couple ? 'default' : 'pointer',
                    opacity: aiLoading || !couple ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {aiLoading ? '...' : 'Refresh'}
                </button>
              )}
            </div>
          </div>
        </GlowBorder>

        {/* AI Analysis details */}
        {result && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* URGENT */}
            {result.urgent.length > 0 && (
              <Card style={{ borderColor: 'rgba(196,120,92,0.25)', padding: '14px 16px' }}>
                <SectionLabel>Urgent — Next 4 Weeks</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {result.urgent.map((item, i) => {
                    const link = resolveItemLink(item.item)
                    return (
                      <div
                        key={i}
                        onClick={() => link && navigate(link)}
                        style={{
                          padding: '8px 0',
                          borderBottom: i < result.urgent.length - 1 ? '1px solid var(--color-bg)' : 'none',
                          cursor: link ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontFamily: 'var(--font-body)', fontSize: '13px',
                              fontWeight: 600, color: '#C4785C', margin: '0 0 2px 0',
                            }}>
                              {item.item}
                            </p>
                            <p style={{
                              fontFamily: 'var(--font-body)', fontSize: '12px',
                              color: 'var(--color-text-secondary)', margin: 0,
                            }}>
                              {item.reason}
                            </p>
                          </div>
                          {link && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C4785C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', opacity: 0.7 }}>
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* WATCH LIST */}
            {result.watch_list.length > 0 && (
              <Card style={{ padding: '14px 16px' }}>
                <SectionLabel>Watch List</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {result.watch_list.map((item, i) => {
                    const link = resolveItemLink(item.item)
                    return (
                      <div
                        key={i}
                        onClick={() => link && navigate(link)}
                        style={{
                          padding: '6px 0',
                          borderBottom: i < result.watch_list.length - 1 ? '1px solid var(--color-bg)' : 'none',
                          cursor: link ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontFamily: 'var(--font-body)', fontSize: '13px',
                            color: 'var(--color-text-primary)', margin: '0 0 2px 0',
                          }}>
                            {item.item}
                          </p>
                          <p style={{
                            fontFamily: 'var(--font-body)', fontSize: '11px',
                            color: 'var(--color-text-secondary)', margin: 0,
                          }}>
                            {item.when}
                          </p>
                        </div>
                        {link && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px', opacity: 0.6 }}>
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* ON TRACK */}
            {result.on_track.length > 0 && (
              <Card style={{ padding: '14px 16px' }}>
                <SectionLabel>On Track</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {result.on_track.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#7B8F6B', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#7B8F6B', lineHeight: 1.4 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Phase Progress Map */}
        <div style={{ marginBottom: '8px' }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--color-text-secondary)', margin: '0 0 10px 0',
          }}>
            Phase Progress
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {phases.map((phase, phaseIdx) => {
            const isCurrent = phase.id === currentPhaseId
            const isPast = currentPhaseIdx > phaseIdx
            const isExpanded = expandedPhases.has(phase.id)

            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                isCurrent={isCurrent}
                isPast={isPast}
                weddingDate={weddingDate}
                expanded={isExpanded}
                onToggle={() => togglePhase(phase.id)}
              />
            )
          })}
        </div>

      </div>
    </AppShell>
  )
}
