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
  type MilestoneInfo,
  type MilestoneCompletion,
} from '../lib/deriveTimelineStatus'
import type { Couple, Vendor, Guest, BudgetCategory } from '../types/database'

type TimelineResult = {
  overall_status: 'On Track' | 'Needs Attention' | 'Behind'
  summary: string
  urgent: { item: string; reason: string }[]
  on_track: string[]
  watch_list: { item: string; when: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  'On Track': '#7B8F6B',
  'Needs Attention': '#B8926A',
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

const MILESTONE_SAGE = '#8B9E7E'
const MILESTONE_GOLD = '#C9A96E'

function formatCompletedDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Circle indicator for a milestone — done (sage check), manual incomplete (gold ring),
// auto in-progress (gold tint), or auto pending (grey ring)
function MilestoneCircle({ m, sparkling }: { m: MilestoneInfo; sparkling: boolean }) {
  const baseStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 700,
    transition: 'background 0.3s ease, border-color 0.3s ease, color 0.3s ease',
    position: 'relative',
  }

  let style: React.CSSProperties
  if (m.status === 'done') {
    style = { ...baseStyle, background: MILESTONE_SAGE, border: `2px solid ${MILESTONE_SAGE}`, color: '#fff' }
  } else if (m.type === 'manual') {
    style = { ...baseStyle, background: 'transparent', border: `1.5px solid ${MILESTONE_GOLD}` }
  } else if (m.status === 'in_progress') {
    style = { ...baseStyle, background: 'rgba(184,146,106,0.15)', border: '2px solid #B8926A' }
  } else {
    style = { ...baseStyle, background: 'transparent', border: '2px solid #D4CFC8' }
  }

  return (
    <div style={style}>
      {m.status === 'done' ? '✓' : ''}
      {sparkling && [0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 5
        return (
          <span
            key={i}
            className="tl-sparkle-dot"
            style={{
              ['--dx' as string]: `${Math.round(Math.cos(angle) * 16)}px`,
              ['--dy' as string]: `${Math.round(Math.sin(angle) * 16)}px`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
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
  sparklingKey,
  confirmKey,
  onMilestoneCheck,
  onUndoConfirm,
  onUndoCancel,
}: {
  phase: PhaseStatus
  isCurrent: boolean
  isPast: boolean
  weddingDate: Date | null
  expanded: boolean
  onToggle: () => void
  sparklingKey: string | null
  confirmKey: string | null
  onMilestoneCheck: (m: MilestoneInfo) => void
  onUndoConfirm: (m: MilestoneInfo) => void
  onUndoCancel: () => void
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

          {allDone && (
            <span style={{
              fontSize: '10px', fontWeight: 600, color: '#5A7A4A',
              background: '#E8F0E4', padding: '2px 7px', borderRadius: '6px',
              fontFamily: 'var(--font-body)', flexShrink: 0,
            }}>
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
          {phase.milestones.map(m => {
            const done = m.status === 'done'
            const navigable = m.type === 'auto' && !done && !!m.link
            return (
              <div key={m.key}>
                <div
                  className="tl-milestone-row"
                  onClick={() => { if (navigable && m.link) navigate(m.link) }}
                  title={m.type === 'auto' && !done ? m.tooltip : undefined}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    cursor: navigable ? 'pointer' : 'default',
                    padding: '4px 6px 4px 0',
                    borderRadius: '6px',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => { if (navigable) (e.currentTarget as HTMLElement).style.background = 'rgba(184,146,106,0.06)' }}
                  onMouseLeave={e => { if (navigable) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {m.type === 'manual' ? (
                    <button
                      className="tl-circle-btn"
                      onClick={e => { e.stopPropagation(); onMilestoneCheck(m) }}
                      aria-label={done ? `Mark "${m.task}" as not done` : `Mark "${m.task}" as done`}
                      style={{
                        background: 'none', border: 'none', padding: 0, margin: '1px 0 0 0',
                        cursor: 'pointer', borderRadius: '50%', flexShrink: 0, lineHeight: 0,
                        transition: 'box-shadow 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 5px rgba(201,169,110,0.1)'; (e.currentTarget as HTMLElement).style.background = 'rgba(201,169,110,0.1)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <MilestoneCircle m={m} sparkling={sparklingKey === m.key} />
                    </button>
                  ) : (
                    <div style={{ marginTop: '1px', flexShrink: 0 }}>
                      <MilestoneCircle m={m} sparkling={false} />
                    </div>
                  )}
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: done ? '#999' : 'var(--color-text-primary)',
                    textDecoration: done ? 'line-through' : 'none',
                    flex: 1,
                    transition: 'color 0.3s ease',
                  }}>
                    {m.task}
                  </span>
                  {done && m.type === 'auto' && m.autoBadge && (
                    <span style={{ fontSize: '10px', fontWeight: 500, color: MILESTONE_SAGE, flexShrink: 0, marginTop: '3px', fontFamily: 'var(--font-body)' }}>
                      {m.autoBadge}
                    </span>
                  )}
                  {done && m.type === 'manual' && (
                    <span style={{ fontSize: '10px', fontWeight: 500, color: MILESTONE_SAGE, flexShrink: 0, marginTop: '3px', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                      Done{m.completedAt ? ` · ${formatCompletedDate(m.completedAt)}` : ''}
                    </span>
                  )}
                  {navigable && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8926A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px', opacity: 0.6 }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </div>

                {/* Inline undo confirmation */}
                {confirmKey === m.key && (
                  <div
                    className="tl-fade-in"
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 0 4px 26px' }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                      Mark as not done?
                    </span>
                    <button
                      onClick={() => onUndoConfirm(m)}
                      style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#C4785C', fontFamily: 'var(--font-body)' }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={onUndoCancel}
                      style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
                    >
                      Cancel
                    </button>
                  </div>
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

  // Manual milestone interaction state
  const [sparklingKey, setSparklingKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  const fingerprintRef = useRef<string>('')
  const completionsRef = useRef<MilestoneCompletion[]>([])
  const rawDataRef = useRef<{ c: Couple; v: Vendor[]; g: Guest[]; b: BudgetCategory[] } | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const c = await getCoupleForUser(user.id)
        if (!c) return
        setCouple(c)

        const [v, g, b, compRes] = await Promise.all([
          getVendorsForCouple(c.id),
          getGuestsForCouple(c.id),
          getBudgetCategories(c.id),
          supabase.from('milestone_completions').select('milestone_key, completed_at').eq('couple_id', c.id),
        ])
        const comps = (compRes.data ?? []) as MilestoneCompletion[]
        completionsRef.current = comps
        rawDataRef.current = { c, v, g, b }

        // Derive phases from actual data + manual completions
        const derived = deriveTimelineStatus(c, v, g, b, comps)
        setPhases(derived)

        // Expand current phase by default (unless every milestone in it is complete)
        const wDate = c.wedding_date ? new Date(c.wedding_date + 'T12:00:00') : null
        if (wDate) {
          const currentId = getCurrentPhaseId(wDate)
          const cur = derived.find(p => p.id === currentId)
          if (cur && cur.doneCount < cur.totalCount) {
            setExpandedPhases(new Set([currentId]))
          }
        }

        // Build fingerprint
        const fp = buildDataFingerprint(c, v, g, b, comps)
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
      if (!silent) setAiError("Couldn't generate AI analysis. Try again.")
    } finally {
      if (!silent) setAiLoading(false)
    }
  }

  function handleRefresh() {
    if (!couple) return
    runAIAssessment(couple.id, fingerprintRef.current, false)
  }

  // Re-derive phases + fingerprint after a completion change
  function applyCompletions(next: MilestoneCompletion[]) {
    completionsRef.current = next
    const raw = rawDataRef.current
    if (!raw) return
    setPhases(deriveTimelineStatus(raw.c, raw.v, raw.g, raw.b, next))
    fingerprintRef.current = buildDataFingerprint(raw.c, raw.v, raw.g, raw.b, next)
    // Let the right panel refresh its YOUR PHASE segments
    window.dispatchEvent(new CustomEvent('veil:milestones-changed'))
  }

  async function completeMilestone(m: MilestoneInfo) {
    if (!couple) return
    const completedAt = new Date().toISOString()
    const prev = completionsRef.current
    applyCompletions([...prev, { milestone_key: m.key, completed_at: completedAt }])
    setSparklingKey(m.key)
    window.setTimeout(() => setSparklingKey(k => (k === m.key ? null : k)), 600)
    track('milestone_completed', { key: m.key })

    const { error } = await supabase
      .from('milestone_completions')
      .upsert(
        { couple_id: couple.id, milestone_key: m.key, completed_at: completedAt },
        { onConflict: 'couple_id,milestone_key' }
      )
    if (error) applyCompletions(prev)
  }

  async function uncompleteMilestone(m: MilestoneInfo) {
    if (!couple) return
    const prev = completionsRef.current
    applyCompletions(prev.filter(c2 => c2.milestone_key !== m.key))
    setConfirmKey(null)
    track('milestone_uncompleted', { key: m.key })

    const { error } = await supabase
      .from('milestone_completions')
      .delete()
      .eq('couple_id', couple.id)
      .eq('milestone_key', m.key)
    if (error) applyCompletions(prev)
  }

  function handleMilestoneCheck(m: MilestoneInfo) {
    if (m.type !== 'manual') return
    if (m.status === 'done') {
      setConfirmKey(k => (k === m.key ? null : m.key))
    } else {
      setConfirmKey(null)
      completeMilestone(m)
    }
  }

  // Click anywhere else dismisses the inline undo confirmation
  useEffect(() => {
    if (!confirmKey) return
    const onDocClick = () => setConfirmKey(null)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [confirmKey])

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
      {/* Scoped styles for two-column layout */}
      <style>{`
        .timeline-columns {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 24px;
          align-items: start;
        }
        .timeline-col {
          max-height: calc(100vh - 160px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #D4CFC8 transparent;
        }
        .timeline-col::-webkit-scrollbar {
          width: 4px;
        }
        .timeline-col::-webkit-scrollbar-track {
          background: transparent;
        }
        .timeline-col::-webkit-scrollbar-thumb {
          background: #D4CFC8;
          border-radius: 4px;
        }
        .timeline-col::-webkit-scrollbar-thumb:hover {
          background: #A89F95;
        }
        @keyframes tl-shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
        @keyframes tl-dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }
        .tl-loading-dots::after {
          content: '';
          animation: tl-dots 1.4s steps(1, end) infinite;
        }
        .tl-skel-bar {
          background: #EDE8E1;
          border-radius: 6px;
          animation: tl-shimmer 1.6s ease-in-out infinite;
        }
        .tl-fade-in {
          animation: tl-fadein 0.3s ease forwards;
        }
        @keyframes tl-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tl-circle-btn {
          position: relative;
        }
        .tl-circle-btn::after {
          content: '';
          position: absolute;
          inset: -14px;
          border-radius: 50%;
        }
        .tl-sparkle-dot {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #C9A96E;
          top: 50%;
          left: 50%;
          margin: -2px 0 0 -2px;
          animation: tl-sparkle 0.5s ease-out forwards;
          pointer-events: none;
        }
        @keyframes tl-sparkle {
          from { opacity: 1; transform: translate(0, 0) scale(1); }
          to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.4); }
        }
        @media (max-width: 768px) {
          .timeline-columns {
            grid-template-columns: 1fr;
          }
          .timeline-col {
            max-height: none;
            overflow-y: visible;
          }
          .tl-milestone-row {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .timeline-columns {
            grid-template-columns: 55fr 45fr;
          }
        }
      `}</style>

      <div>
        {/* Header — full width above both columns */}
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

        {/* Two-column layout */}
        <div className="timeline-columns">

          {/* LEFT COLUMN: AI Assessment */}
          <div className="timeline-col" style={{ paddingRight: '12px' }}>

            {/* AI Advisor card */}
            <GlowBorder style={{ marginBottom: '16px' }}>
              <div style={{
                position: 'relative', zIndex: 1, borderRadius: '12px', background: '#F5F1EC', padding: '16px 18px',
                animation: (aiLoading && !result) ? 'tl-shimmer 2s ease-in-out infinite' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: result ? '10px' : 0, gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: '#B8926A', margin: '0 0 4px 0', fontFamily: 'var(--font-body)', fontWeight: 600,
                    }}>
                      AI Advisor
                    </p>

                    {aiLoading && !result && (
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', margin: '0 0 3px 0', fontWeight: 500 }}>
                          <span className="tl-loading-dots">Analyzing your planning progress</span>
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', margin: 0 }}>
                          This usually takes about 5 seconds
                        </p>
                      </div>
                    )}

                    {!aiLoading && !result && !aiError && (
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', margin: '0 0 3px 0', fontWeight: 500 }}>
                          {couple ? "Are you on track? We'll check your vendors, budget, and payments against your wedding date." : 'Add your wedding date in Settings to get a personalized health check.'}
                        </p>
                        {couple && (
                          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', margin: 0 }}>
                            Get a personalized health check with specific next steps.
                          </p>
                        )}
                      </div>
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

                  {/* Refresh button */}
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

            {/* Skeleton loading cards */}
            {aiLoading && !result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(140,120,100,0.08), 0 4px 12px rgba(140,120,100,0.05)',
                    animationDelay: `${i * 0.2}s`,
                  }}>
                    <div className="tl-skel-bar" style={{ width: '80px', height: '10px', marginBottom: '10px', animationDelay: `${i * 0.2}s` }} />
                    <div className="tl-skel-bar" style={{ width: `${65 - i * 10}%`, height: '13px', marginBottom: '8px', animationDelay: `${i * 0.2 + 0.1}s` }} />
                    <div className="tl-skel-bar" style={{ width: '90%', height: '11px', animationDelay: `${i * 0.2 + 0.2}s` }} />
                  </div>
                ))}
              </div>
            )}

            {/* AI Analysis details */}
            {result && (
              <div className="tl-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* URGENT */}
                {result.urgent.length > 0 && (
                  <Card style={{ borderColor: 'rgba(196,120,92,0.25)', padding: '14px 16px' }}>
                    <SectionLabel>Urgent, Next 4 Weeks</SectionLabel>
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
          </div>

          {/* RIGHT COLUMN: Phase Progress */}
          <div className="timeline-col" style={{ borderLeft: '1px solid #EDE8E1', paddingLeft: '24px' }}>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--color-text-secondary)', margin: '0 0 10px 0',
            }}>
              Phase Progress
            </p>

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
                    sparklingKey={sparklingKey}
                    confirmKey={confirmKey}
                    onMilestoneCheck={handleMilestoneCheck}
                    onUndoConfirm={uncompleteMilestone}
                    onUndoCancel={() => setConfirmKey(null)}
                  />
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
