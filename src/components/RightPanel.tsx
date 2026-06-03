import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getPaymentsForCouple, getUpcomingPayments } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { getCategoriesForCouple, type VendorCategoryConfig } from '../lib/categories'
import { getVendorsForCouple } from '../lib/vendors'
import { MultiSegmentRing } from './MultiSegmentRing'
import { type Couple, type Payment, type Task, type Vendor } from '../types/database'

const TIMELINE_PHASES_PANEL = [
  { id: '12plus', label: '12+ months out', tasks: ['Set a total wedding budget', 'Choose your wedding date', 'Estimate guest count', 'Research and book your venue'] },
  { id: '9to12', label: '9–12 months out', tasks: ['Send save-the-dates', 'Book photographer & videographer', 'Book caterer', 'Book florist', 'Book band or DJ'] },
  { id: '6to9', label: '6–9 months out', tasks: ['Book officiant', 'Book hair & makeup artists', 'Book transportation', 'Start planning honeymoon'] },
  { id: '3to6', label: '3–6 months out', tasks: ['Send formal invitations', 'Register for gifts', 'Menu tasting with caterer', 'Order wedding cake', 'Plan rehearsal dinner'] },
  { id: '1to3', label: '1–3 months out', tasks: ['Confirm all vendor bookings', 'Obtain marriage license', 'Final dress / suit fitting', 'Create seating chart', 'Write vows'] },
  { id: 'weekof', label: 'Week of the wedding', tasks: ['Confirm day-of timeline with vendors', 'Final headcount to caterer', 'Pack for honeymoon', 'Enjoy your rehearsal dinner'] },
]

function getCurrentPhasePanel(weddingDate: Date) {
  const diffMonths = (weddingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)
  if (diffMonths >= 12) return TIMELINE_PHASES_PANEL[0]
  if (diffMonths >= 9) return TIMELINE_PHASES_PANEL[1]
  if (diffMonths >= 6) return TIMELINE_PHASES_PANEL[2]
  if (diffMonths >= 3) return TIMELINE_PHASES_PANEL[3]
  if (diffMonths >= 0) return TIMELINE_PHASES_PANEL[4]
  return TIMELINE_PHASES_PANEL[5]
}

type HealthStatus = 'on_track' | 'needs_attention' | 'behind'
type FactorStatus = 'good' | 'warning' | 'bad'

interface HealthFactor {
  label: string
  status: FactorStatus
  detail: string
}

interface HealthScore {
  status: HealthStatus
  factors: HealthFactor[]
}

function computeHealthScore(
  couple: Couple | null,
  vendors: Vendor[],
  payments: Payment[],
  daysUntil: number | null,
  totalCategories: number
): HealthScore {
  const factors: HealthFactor[] = []

  // 1. Vendors factor — weighted most heavily
  const bookedCount = vendors.filter(v => v.status === 'booked').length
  let expectedBooked = 0
  if (daysUntil !== null) {
    const months = daysUntil / 30.44
    if (months >= 12) expectedBooked = Math.round(totalCategories * 0.15)
    else if (months >= 9) expectedBooked = Math.round(totalCategories * 0.35)
    else if (months >= 6) expectedBooked = Math.round(totalCategories * 0.6)
    else if (months >= 3) expectedBooked = Math.round(totalCategories * 0.8)
    else if (months >= 0) expectedBooked = Math.max(totalCategories - 1, Math.round(totalCategories * 0.95))
    else expectedBooked = totalCategories
  }

  let vendorStatus: FactorStatus
  let vendorDetail: string
  if (daysUntil === null) {
    vendorStatus = 'warning'
    vendorDetail = 'Set wedding date to track'
  } else if (bookedCount >= expectedBooked) {
    vendorStatus = 'good'
    vendorDetail = `${bookedCount} booked`
  } else if (bookedCount >= Math.ceil(expectedBooked * 0.6)) {
    vendorStatus = 'warning'
    vendorDetail = `${bookedCount} of ~${expectedBooked} expected by now`
  } else {
    vendorStatus = 'bad'
    vendorDetail = `${bookedCount} of ~${expectedBooked} expected by now`
  }
  factors.push({ label: 'Vendors', status: vendorStatus, detail: vendorDetail })

  // 2. Budget factor
  const budgetTotal = (couple as any)?.budget_total ?? 0
  let budgetStatus: FactorStatus
  let budgetDetail: string
  if (budgetTotal > 0) {
    budgetStatus = 'good'
    budgetDetail = 'Total budget set'
  } else {
    budgetStatus = 'warning'
    budgetDetail = 'No total budget set'
  }
  factors.push({ label: 'Budget', status: budgetStatus, detail: budgetDetail })

  // 3. Payments factor — weighted by dollar amount
  const today = new Date().toISOString().split('T')[0]
  const overduePayments = payments.filter(p => !p.paid_date && p.due_date && p.due_date < today)
  const overdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  let paymentStatus: FactorStatus
  let paymentDetail: string
  if (overduePayments.length === 0) {
    paymentStatus = 'good'
    paymentDetail = 'All on time'
  } else if (overdueAmount >= 5000 || overduePayments.length >= 3) {
    paymentStatus = 'bad'
    paymentDetail = `${overdueAmount.toLocaleString()} overdue across ${overduePayments.length} payment${overduePayments.length > 1 ? 's' : ''}`
  } else {
    paymentStatus = 'warning'
    paymentDetail = `${overdueAmount.toLocaleString()} overdue (${overduePayments.length} payment${overduePayments.length > 1 ? 's' : ''})`
  }
  factors.push({ label: 'Payments', status: paymentStatus, detail: paymentDetail })

  const hasBad = factors.some(f => f.status === 'bad')
  const hasWarning = factors.some(f => f.status === 'warning')
  const status: HealthStatus = hasBad ? 'behind' : hasWarning ? 'needs_attention' : 'on_track'

  return { status, factors }
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  on_track: 'On Track',
  needs_attention: 'Needs Attention',
  behind: 'Behind',
}

const STATUS_COLOR: Record<HealthStatus, string> = {
  on_track: '#7B8F6B',
  needs_attention: '#B8926A',
  behind: '#C4785C',
}

const STATUS_BG: Record<HealthStatus, string> = {
  on_track: 'rgba(123,143,107,0.07)',
  needs_attention: 'rgba(184,146,106,0.07)',
  behind: 'rgba(196,120,92,0.07)',
}

const FACTOR_COLOR: Record<FactorStatus, string> = {
  good: '#7B8F6B',
  warning: '#B8926A',
  bad: '#C4785C',
}

const PANEL_STYLE = {
  width: '252px',
  flexShrink: 0,
  background: '#fff',
  borderLeft: '1px solid var(--color-border)',
  padding: '28px 18px',
  height: '100vh',
  position: 'sticky' as const,
  top: 0,
  overflowY: 'auto' as const,
  boxSizing: 'border-box' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0',
}

const LABEL_STYLE = {
  fontFamily: 'var(--font-body)',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  margin: '0 0 12px 0',
}

export default function RightPanel() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [couple, setCouple] = useState<Couple | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [vendorCategories, setVendorCategories] = useState<VendorCategoryConfig[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [guestCount, setGuestCount] = useState(0)
  const [healthExpanded, setHealthExpanded] = useState(false)

  if (pathname === '/settings') return null

  const isVendors = pathname.startsWith('/vendors')
  const isBudget = pathname === '/budget'
  const isTimeline = pathname === '/timeline'
  const isFinances = pathname === '/finances'
  const isVenue = pathname === '/venue'
  const isTasks = pathname === '/todos'
  const isHome = !isVendors && !isBudget && !isTimeline && !isFinances && !isVenue && !isTasks

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)

      const [p, t, cats, vends, guestRes] = await Promise.all([
        getPaymentsForCouple(c.id),
        getTasksForCouple(c.id),
        getCategoriesForCouple(c.id),
        getVendorsForCouple(c.id),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('couple_id', c.id),
      ])
      setPayments(p)
      setTasks(t)
      setVendorCategories(cats)
      setVendors(vends)
      setGuestCount(guestRes.count ?? 0)
    }
    load()
  }, [pathname])

  const daysUntil = couple?.wedding_date
    ? Math.ceil((new Date(couple.wedding_date).getTime() - Date.now()) / 86400000)
    : null

  // Progress ring: 0 at 540+ days out, 1 at wedding day (18-month window)
  const countdownProgress = daysUntil !== null
    ? Math.max(0, Math.min(1, (540 - daysUntil) / 540))
    : 0

  const ProfileHeader = () => (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #B8926A 0%, #A17D55 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '8px',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </div>

      {couple?.name_primary && (
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
          {couple.name_primary}
          {couple.name_partner && (
            <> <span style={{ color: 'var(--color-accent)' }}>&</span> {couple.name_partner}</>
          )}
        </p>
      )}

      {daysUntil !== null ? (
        <>
          <div style={{ marginBottom: '6px' }}>
            <MultiSegmentRing
              data={countdownProgress > 0 ? [{ value: countdownProgress, color: '#B8926A' }] : []}
              totalValue={1}
              size={80}
              strokeWidth={5}
            >
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>
                {daysUntil}
              </span>
            </MultiSegmentRing>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>days to go</span>
          {couple?.wedding_date && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
              {new Date(couple.wedding_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </>
      ) : (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Set your wedding date in Settings
        </p>
      )}
    </div>
  )

  const Divider = () => <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '22px' }} />

  // --- VENDORS panel ---
  if (isVendors) {
    const bookedCats = vendorCategories.filter(cat =>
      vendors.some(v => v.category === cat.slug && v.status === 'booked')
    )
    const openCats = vendorCategories.filter(cat =>
      !vendors.some(v => v.category === cat.slug && v.status === 'booked')
    )
    const total = vendorCategories.length
    const bookedCount = bookedCats.length

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        <div style={{ marginBottom: '24px' }}>
          <p style={LABEL_STYLE}>Vendor Progress</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {bookedCount}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              of {total} booked
            </span>
          </div>
          <div style={{ height: '5px', background: '#EDE8E1', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: total > 0 ? `${(bookedCount / total) * 100}%` : '0%', height: '100%', background: 'var(--color-status-booked)', borderRadius: '3px' }} />
          </div>
        </div>

        <Divider />

        <div>
          <p style={LABEL_STYLE}>Still Open</p>
          {openCats.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-status-booked)', margin: 0, fontWeight: 600 }}>
              All vendors booked!
            </p>
          ) : openCats.slice(0, 7).map(cat => {
            const hasActive = vendors.some(v =>
              v.category === cat.slug && ['researching', 'shortlisted', 'meeting_scheduled'].includes(v.status)
            )
            return (
              <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                  {cat.label}
                </span>
                {hasActive && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-accent)', background: 'var(--color-sidebar-active)', padding: '1px 6px', borderRadius: '5px', fontWeight: 600 }}>
                    Active
                  </span>
                )}
              </div>
            )
          })}
          {openCats.length > 7 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
              +{openCats.length - 7} more
            </p>
          )}
        </div>
      </div>
    )
  }

  // --- BUDGET panel ---
  if (isBudget) {
    const totalBudget = (couple as any)?.budget_total ?? 0
    const totalPaid = payments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0)
    const totalDue = payments.filter(p => !p.paid_date).reduce((sum, p) => sum + p.amount, 0)
    const committed = totalPaid + totalDue
    const paidPercent = totalBudget > 0 ? Math.min(100, Math.round((totalPaid / totalBudget) * 100)) : 0
    const overBudget = totalBudget > 0 && committed > totalBudget
    const nearBudget = !overBudget && totalBudget > 0 && committed > totalBudget * 0.9
    const upcomingPayments = getUpcomingPayments(payments).slice(0, 3)

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        <div style={{ marginBottom: '20px' }}>
          <p style={LABEL_STYLE}>Budget Health</p>

          {overBudget && (
            <div style={{ background: 'rgba(196,120,92,0.08)', border: '1px solid rgba(196,120,92,0.25)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#C4785C', fontWeight: 600, margin: 0 }}>
                Over budget
              </p>
            </div>
          )}
          {nearBudget && (
            <div style={{ background: 'rgba(154,120,64,0.08)', border: '1px solid var(--color-status-short)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-status-short)', fontWeight: 600, margin: 0 }}>
                Approaching limit
              </p>
            </div>
          )}

          {totalBudget > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Paid so far</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-primary)' }}>{paidPercent}%</span>
              </div>
              <div style={{ height: '5px', background: '#EDE8E1', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${paidPercent}%`, height: '100%', background: overBudget ? '#C4785C' : 'var(--color-accent)', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Remaining</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: overBudget ? '#C4785C' : 'var(--color-text-primary)', fontWeight: 600 }}>
                  ${Math.max(0, totalBudget - totalPaid).toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Set a total budget in Settings
            </p>
          )}
        </div>

        <Divider />

        <div>
          <p style={LABEL_STYLE}>Up Next</p>
          {upcomingPayments.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>No upcoming payments</p>
          ) : upcomingPayments.map(p => (
            <div key={p.id} style={{ marginBottom: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {p.label}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                  ${p.amount.toLocaleString()}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {p.due_date ? `Due ${p.due_date}` : 'No due date'}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- TIMELINE panel ---
  if (isTimeline) {
    const weddingDate = couple?.wedding_date ? new Date(couple.wedding_date + 'T12:00:00') : null
    const currentPhase = weddingDate ? getCurrentPhasePanel(weddingDate) : TIMELINE_PHASES_PANEL[0]
    const phaseIdx = TIMELINE_PHASES_PANEL.findIndex(p => p.id === currentPhase.id)
    const phasesCompleted = phaseIdx
    const totalPhases = TIMELINE_PHASES_PANEL.length

    const milestones = [
      { label: 'Budget set', done: (couple?.budget_total ?? 0) > 0 },
      { label: 'Date chosen', done: !!couple?.wedding_date },
      { label: 'Venue secured', done: vendors.some(v => v.category === 'venue' && v.status === 'booked') || !!couple?.venue_name },
      { label: 'Guest list started', done: guestCount > 0 },
      { label: 'Photographer booked', done: vendors.some(v => v.category === 'photographer' && v.status === 'booked') },
      { label: 'Caterer booked', done: vendors.some(v => v.category === 'caterer' && v.status === 'booked') },
    ]
    const doneMilestones = milestones.filter(m => m.done)

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        <div style={{ marginBottom: '24px' }}>
          <p style={LABEL_STYLE}>Your Phase</p>
          <div style={{ background: 'var(--color-sidebar-active)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', margin: '0 0 2px 0' }}>
              {currentPhase.label}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {phasesCompleted} of {totalPhases} phases complete
            </p>
          </div>
          <div style={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: totalPhases }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: '5px', borderRadius: '3px', background: i < phasesCompleted ? '#7B8F6B' : '#EDE8E1' }} />
            ))}
          </div>
        </div>

        <Divider />

        <div>
          <p style={LABEL_STYLE}>Milestones</p>
          {doneMilestones.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Complete your first milestone to see progress here.
            </p>
          ) : doneMilestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'center', marginBottom: '10px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" fill="rgba(123,143,107,0.15)" />
                <path d="M8 12l3 3 5-5" stroke="#7B8F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#7B8F6B', lineHeight: 1.4, fontWeight: 500 }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- FINANCES panel ---
  if (isFinances) {
    const today2 = new Date().toISOString().split('T')[0]
    const next60Days = new Date()
    next60Days.setDate(next60Days.getDate() + 60)
    const next60Str = next60Days.toISOString().split('T')[0]
    const upcomingPayments = payments
      .filter(p => !p.paid_date && p.due_date && p.due_date >= today2 && p.due_date <= next60Str)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .slice(0, 5)
    const totalPaid = payments.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
    const totalDue = payments.reduce((s, p) => s + p.amount, 0)
    const paidPct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        <div style={{ marginBottom: '20px' }}>
          <p style={LABEL_STYLE}>Payment Progress</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-text-primary)' }}>${totalPaid.toLocaleString()}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>of ${totalDue.toLocaleString()}</span>
          </div>
          <div style={{ height: '5px', background: '#EDE8E1', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ width: `${paidPct}%`, height: '100%', background: '#7B8F6B', borderRadius: '3px' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{paidPct}% paid</p>
        </div>

        <Divider />

        <div>
          <p style={LABEL_STYLE}>Due Next 60 Days</p>
          {upcomingPayments.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>No upcoming payments.</p>
          ) : upcomingPayments.map(p => {
            const daysUntilDue = p.due_date ? Math.ceil((new Date(p.due_date + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>{p.label}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: daysUntilDue !== null && daysUntilDue <= 14 ? '#C4785C' : 'var(--color-text-secondary)', margin: 0 }}>
                    {daysUntilDue !== null ? `${daysUntilDue}d` : '—'}
                  </p>
                </div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--color-text-primary)' }}>${p.amount.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // --- VENUE panel ---
  if (isVenue) {
    const venue = vendors.find(v => v.category === 'venue') ?? null
    const venuePayments = venue ? payments.filter(p => p.vendor_id === venue.id) : []
    const venuePaid = venuePayments.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
    const venueTotal = venue?.booked_amount ?? 0
    const venueRemaining = venueTotal - venuePaid
    const nextVenuePayment = venuePayments
      .filter(p => !p.paid_date && p.due_date)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        {!venue || venue.status === 'not_started' ? (
          <div>
            <p style={LABEL_STYLE}>Venue</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              No venue booked yet. Your venue sets the tone for everything — guest count, catering, florals.
            </p>
          </div>
        ) : (
          <div>
            <p style={LABEL_STYLE}>Venue</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: 'var(--color-text-primary)', margin: '0 0 12px 0', lineHeight: 1.3 }}>{venue.name ?? 'Your Venue'}</p>

            {venueTotal > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Paid</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-primary)', fontWeight: 600 }}>${venuePaid.toLocaleString()} / ${venueTotal.toLocaleString()}</span>
                </div>
                <div style={{ height: '4px', background: '#EDE8E1', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round((venuePaid / venueTotal) * 100))}%`, height: '100%', background: '#7B8F6B', borderRadius: '3px' }} />
                </div>
              </div>
            )}

            {nextVenuePayment && (
              <div style={{ background: 'var(--color-sidebar-active)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Next Payment</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)' }}>{nextVenuePayment.label}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--color-text-primary)' }}>${nextVenuePayment.amount.toLocaleString()}</span>
                </div>
                {nextVenuePayment.due_date && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Due {nextVenuePayment.due_date}</p>
                )}
              </div>
            )}

            {venueRemaining > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Remaining</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)' }}>${venueRemaining.toLocaleString()}</span>
              </div>
            )}

            {venue.contact_name && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contact</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', margin: 0 }}>{venue.contact_name}</p>
                {venue.contact_phone && (
                  <a href={`tel:${venue.contact_phone}`} style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none' }}>{venue.contact_phone}</a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // --- TASKS / TODOS panel ---
  if (isTasks) {
    const today3 = new Date().toISOString().split('T')[0]
    const weddingDateTasks = couple?.wedding_date ? new Date(couple.wedding_date + 'T12:00:00') : null
    const currentPhaseTasks = weddingDateTasks ? getCurrentPhasePanel(weddingDateTasks) : TIMELINE_PHASES_PANEL[0]
    const phaseIdxTasks = TIMELINE_PHASES_PANEL.findIndex(p => p.id === currentPhaseTasks.id)
    const phasesCompletedTasks = phaseIdxTasks
    const totalPhasesTasks = TIMELINE_PHASES_PANEL.length
    const totalTasksCount = tasks.length
    const completedTasksCount = tasks.filter(t => t.completed).length
    const overdueTasksList = tasks.filter(t => !t.completed && t.due_date && t.due_date < today3)
    const upcomingTasksList = tasks
      .filter(t => !t.completed && (!t.due_date || t.due_date >= today3))
      .slice(0, 4)

    return (
      <div style={PANEL_STYLE}>
        <ProfileHeader />
        <Divider />

        <div style={{ marginBottom: '20px' }}>
          <p style={LABEL_STYLE}>Progress</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--color-text-primary)' }}>{completedTasksCount}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>of {totalTasksCount} tasks</span>
          </div>
          <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
            {Array.from({ length: totalPhasesTasks }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '3px', background: i < phasesCompletedTasks ? '#7B8F6B' : '#EDE8E1' }} />
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', margin: 0 }}>{currentPhaseTasks.label}</p>
        </div>

        {overdueTasksList.length > 0 && (
          <>
            <Divider />
            <div style={{ marginBottom: '16px' }}>
              <p style={{ ...LABEL_STYLE, color: '#C4785C' }}>Overdue ({overdueTasksList.length})</p>
              {overdueTasksList.slice(0, 3).map(t => (
                <div key={t.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C4785C', flexShrink: 0, marginTop: '5px' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{t.title}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider />

        <div>
          <p style={LABEL_STYLE}>Up Next</p>
          {upcomingTasksList.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>All caught up!</p>
          ) : upcomingTasksList.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0, marginTop: '5px' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{t.title}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- HOME / DEFAULT panel ---
  const upcoming = getUpcomingPayments(payments).slice(0, 4)
  const today = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 5)
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today)

  // Next Up: first 3 tasks from current timeline phase
  const weddingDateHome = couple?.wedding_date ? new Date(couple.wedding_date + 'T12:00:00') : null
  const nextUpTasks: string[] = []
  if (weddingDateHome) {
    const currentPhase = getCurrentPhasePanel(weddingDateHome)
    const phaseIdx = TIMELINE_PHASES_PANEL.findIndex(p => p.id === currentPhase.id)
    for (let i = phaseIdx; i < TIMELINE_PHASES_PANEL.length && nextUpTasks.length < 3; i++) {
      for (const t of TIMELINE_PHASES_PANEL[i].tasks) {
        nextUpTasks.push(t)
        if (nextUpTasks.length === 3) break
      }
    }
  }

  // Wedding health score
  const healthScore = isHome
    ? computeHealthScore(couple, vendors, payments, daysUntil, vendorCategories.length)
    : null

  return (
    <div style={PANEL_STYLE}>
      <ProfileHeader />
      <Divider />

      {/* Wedding Health Score */}
      {healthScore && (
        <div style={{ marginBottom: '20px' }}>
          <p style={LABEL_STYLE}>Planning Health</p>
          <div
            onClick={() => setHealthExpanded(e => !e)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
              background: STATUS_BG[healthScore.status],
              border: `1px solid ${STATUS_COLOR[healthScore.status]}40`,
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: STATUS_COLOR[healthScore.status],
                boxShadow: `0 0 6px ${STATUS_COLOR[healthScore.status]}80`,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700,
                color: STATUS_COLOR[healthScore.status],
              }}>
                {STATUS_LABEL[healthScore.status]}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1 }}>
              {healthExpanded ? '▴' : '▾'}
            </span>
          </div>

          {healthExpanded && (
            <div style={{ padding: '10px 4px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {healthScore.factors.map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: FACTOR_COLOR[f.status],
                    flexShrink: 0, marginTop: '4px',
                  }} />
                  <div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {f.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {' — '}{f.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {healthScore && <Divider />}

      {/* Next Up — timeline tasks for current phase */}
      {nextUpTasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={LABEL_STYLE}>Next Up</p>
          {nextUpTasks.map((task, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '9px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B8926A', flexShrink: 0, marginTop: '5px' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{task}</span>
            </div>
          ))}
        </div>
      )}

      {nextUpTasks.length > 0 && <Divider />}

      {/* Upcoming payments */}
      <div style={{ marginBottom: '24px' }}>
        <p style={LABEL_STYLE}>Upcoming Payments</p>

        {upcoming.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            None scheduled
          </p>
        ) : upcoming.map(p => (
          <div key={p.id} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                {p.label}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                ${p.amount.toLocaleString()}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {p.due_date ? `Due ${p.due_date}` : 'No due date'}
            </p>
          </div>
        ))}

        <button
          onClick={() => navigate('/finances')}
          style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          View all payments →
        </button>
      </div>

      <Divider />

      {/* Pending tasks */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ ...LABEL_STYLE, margin: 0 }}>Tasks</p>
          {overdueTasks.length > 0 && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', background: '#F4E4DE', color: '#A15E42', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              {overdueTasks.length} overdue
            </span>
          )}
        </div>

        {pendingTasks.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            All caught up!
          </p>
        ) : pendingTasks.map(t => {
          const isOverdue = t.due_date && t.due_date < today
          return (
            <div key={t.id} style={{ display: 'flex', gap: '9px', marginBottom: '11px', alignItems: 'flex-start' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', border: '2px solid var(--color-border)', flexShrink: 0, marginTop: '5px' }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', margin: '0 0 1px 0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </p>
                {t.due_date && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: isOverdue ? '#C4785C' : 'var(--color-text-secondary)', margin: 0, fontWeight: isOverdue ? 600 : 400 }}>
                    {isOverdue ? '⚠ ' : ''}Due {t.due_date}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={() => navigate('/todos')}
          style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
        >
          View all tasks →
        </button>
      </div>

      <Divider />

      {/* Quick actions */}
      <div>
        <p style={LABEL_STYLE}>Quick Actions</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { label: 'Add Vendor', path: '/vendors' },
            { label: 'View Timeline', path: '/timeline' },
            { label: 'Track Payments', path: '/finances' },
          ].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                fontFamily: 'var(--font-body)', fontSize: '11px',
                padding: '5px 12px', borderRadius: '20px',
                border: '1px solid var(--color-border)',
                background: '#fff', color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
