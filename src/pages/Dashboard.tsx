import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import WelcomeCelebration from '../components/WelcomeCelebration'
import { MultiSegmentRing } from '../components/MultiSegmentRing'
import AiAdvisorCard from '../components/AiAdvisorCard'
import { supabase } from '../lib/supabase'
import { deriveBudgetRange } from '../lib/budget'
import { getCoupleForUser, updateCouple } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { getPaymentsForCouple, getUpcomingPayments } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { type Couple, type Vendor, type Payment, type Task } from '../types/database'
import { getCategoriesForCouple } from '../lib/categories'

// ── Helpers ─────────────────────────────────────────────────────────────────

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS = ['#B8926A', '#7B8F6B', '#6B8FAE', '#9B7FA6', '#5A8F8F', '#C4785C', '#C4A5A8']

const PRIORITY_CONFIG = {
  urgent:    { color: '#C4785C', label: 'Urgent',    bg: 'rgba(196,120,92,0.05)',  border: 'rgba(196,120,92,0.18)' },
  important: { color: '#B8926A', label: 'This week', bg: 'rgba(184,146,106,0.05)', border: 'rgba(184,146,106,0.22)' },
  suggested: { color: '#9B9990', label: 'Suggested', bg: '#FAFAF8',                border: 'rgba(0,0,0,0.07)'       },
} as const

// ── Types ───────────────────────────────────────────────────────────────────

type Priority = 'urgent' | 'important' | 'suggested'

type ActionCard = {
  priority: Priority
  title: string
  context: string
  ctaLabel: string
  ctaPath: string
}

// ── Logic helpers ───────────────────────────────────────────────────────────

function getContextualStatus(
  daysUntil: number | null,
  bookedCount: number,
  totalCategories: number,
  overdueCount: number,
  city?: string | null,
): string {
  if (daysUntil === null) return 'Add your wedding date to get personalized planning guidance. Once we know your date and city, we can tell you exactly what to focus on.'
  if (daysUntil < 0)  return 'Your wedding day has passed. Congratulations!'
  if (daysUntil <= 30)  return 'Almost there! Focus on final confirmations and enjoy the moment.'
  if (daysUntil <= 90)  return 'Final stretch. Confirm all vendor bookings and lock in your day-of timeline.'
  if (daysUntil <= 180) {
    if (overdueCount > 0) return `${overdueCount} task${overdueCount > 1 ? 's' : ''} need${overdueCount === 1 ? 's' : ''} your attention. Stay on top of the details now.`
    const left = totalCategories - bookedCount
    return left > 0
      ? `Final stretch. ${left} vendor ${left === 1 ? 'category' : 'categories'} still need${left === 1 ? 's' : ''} attention.`
      : 'Final stretch. Vendors are locked in, focus on the details now.'
  }
  if (daysUntil <= 365) {
    const left = totalCategories - bookedCount
    const months = Math.round(daysUntil / 30.44)
    const loc = city ? ` ${city}` : ''
    return left > 0
      ? `You're ${months} months out${loc ? ` from your${loc} wedding` : ''}. ${left} of ${totalCategories} vendor categories still need attention.`
      : `You're ${months} months out${loc ? ` from your${loc} wedding` : ''}, and your vendors are looking great.`
  }
  const months = Math.round(daysUntil / 30.44)
  const loc = city ? ` in ${city}` : ''
  if (bookedCount === 0) return `You're ${months} months out${loc}. Lock in your venue and photographer first.`
  return `You're ${months} months out${loc} with ${bookedCount} vendor${bookedCount > 1 ? 's' : ''} booked. Focus on locking in your top picks this month.`
}

function generateActionCards(
  daysUntil: number | null,
  couple: Couple | null,
  vendors: Vendor[],
  categorySlugs: string[],
  categoryLabels: Record<string, string>,
  tasks: Task[],
  payments: Payment[],
): ActionCard[] {
  if (!couple || daysUntil === null) {
    return [{
      priority: 'suggested',
      title: 'Set your wedding date',
      context: 'Your date drives everything — vendor availability, booking urgency, and your planning timeline.',
      ctaLabel: 'Go to Settings',
      ctaPath: '/settings',
    }]
  }

  if (daysUntil < 0) {
    return [{
      priority: 'suggested',
      title: 'Your big day has passed',
      context: 'Congratulations! We hope everything went beautifully.',
      ctaLabel: 'View Budget',
      ctaPath: '/budget',
    }]
  }

  const days = daysUntil
  const cards: ActionCard[] = []

  const isBooked     = (s: string) => vendors.some(v => v.category === s && v.status === 'booked')
  const isInProgress = (s: string) => vendors.some(v => v.category === s && ['researching', 'shortlisted', 'meeting_scheduled'].includes(v.status))
  const has          = (s: string) => categorySlugs.includes(s)

  const today = new Date().toISOString().split('T')[0]
  const overdue = tasks.filter(t => !t.completed && t.due_date && t.due_date < today)

  // Overdue tasks — surface first if severe
  if (overdue.length >= 3) {
    cards.push({
      priority: 'urgent',
      title: `${overdue.length} tasks are overdue`,
      context: "Several items that needed attention haven't been completed. Clearing these keeps your planning on track.",
      ctaLabel: 'Clear overdue tasks',
      ctaPath: '/todos',
    })
  }

  // Budget not set
  if (!couple.budget_total && !couple.budget_range) {
    cards.push({
      priority: days < 365 ? 'urgent' : 'important',
      title: 'Set your wedding budget',
      context: 'Your budget drives every vendor decision, payment schedule, and trade-off ahead. Start here.',
      ctaLabel: 'Set budget',
      ctaPath: '/settings',
    })
  }

  // Venue
  if (has('venue') && !isBooked('venue')) {
    const inProg = isInProgress('venue')
    const coldStart = localStorage.getItem('veil_onboarding_booked') === '[]'
    cards.push({
      priority: days < 300 ? 'urgent' : days < 450 ? 'important' : coldStart ? 'important' : 'suggested',
      title: inProg ? 'Lock in your venue' : 'Start your venue search',
      context: days < 270
        ? 'At this stage, venue availability is tight. If you have candidates, book now.'
        : 'Your venue sets the date, capacity, and catering constraints. Everything else flows from this.',
      ctaLabel: inProg ? 'Compare venues' : 'Browse venues',
      ctaPath: '/vendors/venue',
    })
  }

  // Photographer
  if (has('photographer') && !isBooked('photographer') && days < 500) {
    const inProg = isInProgress('photographer')
    cards.push({
      priority: days < 365 ? 'urgent' : 'important',
      title: inProg ? 'Book your photographer' : 'Find a photographer',
      context: days < 270
        ? 'Great photographers are nearly fully booked at this stage. If you have candidates, choose quickly.'
        : 'Quality photographers book 12–18 months out. Locking this in early is one of the best moves you can make.',
      ctaLabel: inProg ? 'Compare & book' : 'Find photographers',
      ctaPath: '/vendors/photographer',
    })
  }

  // Caterer
  if (has('caterer') && !isBooked('caterer') && days < 365) {
    const inProg = isInProgress('caterer')
    cards.push({
      priority: days < 270 ? 'urgent' : 'important',
      title: 'Confirm catering',
      context: 'Catering is often tied to your venue contract. Check if your venue has preferred caterers or restrictions.',
      ctaLabel: inProg ? 'Review options' : 'Research caterers',
      ctaPath: '/vendors/caterer',
    })
  }

  // Band / DJ
  if (has('band_dj') && !isBooked('band_dj') && days < 400) {
    const inProg = isInProgress('band_dj')
    cards.push({
      priority: days < 270 ? 'urgent' : 'important',
      title: inProg ? 'Book your band or DJ' : 'Get band / DJ quotes',
      context: 'Live music for peak-season Saturdays books 12+ months ahead — more time-sensitive than most couples expect.',
      ctaLabel: inProg ? 'Compare options' : 'Find musicians',
      ctaPath: '/vendors/band_dj',
    })
  }

  // Florist
  if (has('florist') && !isBooked('florist') && days < 270) {
    cards.push({
      priority: days < 180 ? 'urgent' : 'important',
      title: isInProgress('florist') ? 'Book a florist' : 'Find a florist',
      context: 'Florists handle your ceremony arrangements, centerpieces, and bridal flowers. Give them at least 6 months.',
      ctaLabel: isInProgress('florist') ? 'Book florist' : 'Find florists',
      ctaPath: '/vendors/florist',
    })
  }

  // Shortlisted vendor ready to book
  if (cards.length < 3) {
    for (const slug of categorySlugs) {
      if (isBooked(slug)) continue
      const shortlisted = vendors.filter(v => v.category === slug && v.status === 'shortlisted')
      if (shortlisted.length >= 2 && !cards.some(c => c.ctaPath.includes(slug))) {
        const label = (categoryLabels[slug] ?? slug).toLowerCase()
        cards.push({
          priority: 'important',
          title: `Compare your ${label} options`,
          context: `You have ${shortlisted.length} shortlisted options. Review them side by side and lock one in.`,
          ctaLabel: 'Compare & book',
          ctaPath: `/vendors/${slug}`,
        })
        break
      }
    }
  }

  // Payment due in next 14 days
  if (cards.length < 3) {
    const soon = payments
      .filter(p => !p.paid_date && p.due_date)
      .filter(p => {
        const diff = (new Date(p.due_date! + 'T12:00:00').getTime() - Date.now()) / 86400000
        return diff >= 0 && diff <= 14
      })
    if (soon.length > 0) {
      const total = soon.reduce((s, p) => s + p.amount, 0)
      cards.push({
        priority: soon.length >= 2 ? 'urgent' : 'important',
        title: soon.length === 1 ? `Payment due: ${soon[0].label}` : `${soon.length} payments due soon`,
        context: soon.length === 1
          ? `$${soon[0].amount.toLocaleString()} due on ${soon[0].due_date}. Mark it paid once sent.`
          : `$${total.toLocaleString()} total due in the next 14 days.`,
        ctaLabel: 'View payments',
        ctaPath: '/finances',
      })
    }
  }

  // Fallback
  if (cards.length === 0) {
    const unbooked = categorySlugs.filter(s => !isBooked(s)).length
    // An empty category list is not "everything is booked" — it means categories
    // haven't loaded yet. Claiming otherwise told brand-new couples they'd booked
    // every vendor while the stat card next to it read 0/0.
    if (categorySlugs.length === 0) {
      cards.push({
        priority: 'suggested',
        title: 'Start with your vendors',
        context: 'Pick the categories that matter most to you and we\'ll help you find and compare options.',
        ctaLabel: 'View vendors',
        ctaPath: '/vendors',
      })
    } else {
    cards.push(unbooked > 0
      ? {
          priority: 'suggested',
          title: 'Continue booking vendors',
          context: `${unbooked} vendor ${unbooked === 1 ? 'category' : 'categories'} still need attention. Keep the momentum going.`,
          ctaLabel: 'View vendors',
          ctaPath: '/vendors',
        }
      : {
          priority: 'suggested',
          title: 'Review your payment schedule',
          context: 'All vendors are booked! Make sure your payment dates are tracked and up to date.',
          ctaLabel: 'View finances',
          ctaPath: '/finances',
        }
    )
    }
  }

  const order: Record<Priority, number> = { urgent: 0, important: 1, suggested: 2 }
  return cards.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3)
}

// ── Donut ring ─────────────────────────────────────────────────────────────

function DonutRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const sw = 5
  const r  = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct / 100)))
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE8E1" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct <= 0 ? '#E8E8EF' : 'var(--color-accent)'} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Action card ─────────────────────────────────────────────────────────────

function ActionCardView({ card, navigate }: { card: ActionCard; navigate: (path: string) => void }) {
  const { color, label, bg, border } = PRIORITY_CONFIG[card.priority]
  return (
    <div style={{
      flex: 1,
      background: bg,
      border: `1px solid ${border}`,
      borderLeft: card.priority === 'urgent' ? '4px solid #C4785C' : `1px solid ${border}`,
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 1px 4px rgba(140,120,100,0.06)',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>
          {label}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {card.title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.55 }}>
          {card.context}
        </p>
      </div>

      <button
        onClick={() => navigate(card.ctaPath)}
        style={{
          fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600,
          color, background: `${color}14`, border: `1px solid ${border}`,
          borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
          alignSelf: 'flex-start', whiteSpace: 'nowrap',
        }}
      >
        {card.ctaLabel} →
      </button>
    </div>
  )
}

// ── Compact stat card ───────────────────────────────────────────────────────

function CompactStatCard({ label, value, sub, pct, onClick, valueClassName }: {
  label: string; value: string; sub?: string; pct: number; onClick?: () => void; valueClassName?: string
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(140,120,100,0.06)',
        minWidth: 0,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(140,120,100,0.12)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(140,120,100,0.06)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, margin: '0 0 4px 0' }}>
          {label}
        </p>
        <p className={valueClassName} style={{ ...(!valueClassName && { fontFamily: 'var(--font-body)', fontSize: '26px', fontWeight: 700 }), color: 'var(--color-text-primary)', lineHeight: 1, margin: '0 0 3px 0' }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {sub}
          </p>
        )}
      </div>
      <DonutRing pct={pct} />
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: '10px',
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 14px 0',
    }}>
      {children}
    </p>
  )
}

// ── Budget breakdown card ──────────────────────────────────────────────────

function BudgetBreakdownCard({ vendors, categoryLabels }: { vendors: Vendor[]; categoryLabels: Record<string, string> }) {
  const catMap: Record<string, { label: string; amount: number }> = {}
  for (const v of vendors) {
    if (v.status !== 'booked' || !v.booked_amount) continue
    const label = categoryLabels[v.category] ?? v.category
    if (!catMap[label]) catMap[label] = { label, amount: 0 }
    catMap[label].amount += v.booked_amount
  }
  const entries = Object.values(catMap).filter(e => e.amount > 0)
  const totalCommitted = entries.reduce((s, e) => s + e.amount, 0)
  const segments = entries.map((e, i) => ({ value: e.amount, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], label: e.label }))

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(140,120,100,0.06)', display: 'flex', flexDirection: 'column' }}>
      <SectionHeader>Budget Breakdown</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <MultiSegmentRing data={segments} size={140} strokeWidth={20}>
          <div style={{ textAlign: 'center' }}>
            <p className="currency currency-sm" style={{ color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>
              {totalCommitted > 0 ? `$${Math.round(totalCommitted / 1000)}K` : '$0'}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0 }}>committed</p>
          </div>
        </MultiSegmentRing>
        {segments.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '12px 0 0 0', textAlign: 'center' }}>No commitments yet</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', justifyContent: 'center' }}>
            {segments.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {s.label} ${Math.round(s.value / 1000)}K
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Upcoming payments card ─────────────────────────────────────────────────

function UpcomingPaymentsCard({ payments, navigate }: { payments: Payment[]; navigate: (path: string) => void }) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = getUpcomingPayments(payments, 4)

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(140,120,100,0.06)', display: 'flex', flexDirection: 'column' }}>
      <SectionHeader>Upcoming Payments</SectionHeader>
      {upcoming.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, flex: 1 }}>No upcoming payments</p>
      ) : (
        <div style={{ flex: 1 }}>
          {upcoming.map(p => {
            const isOverdue = p.due_date && p.due_date < today
            const dotColor = isOverdue ? '#C4785C' : '#B8926A'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: isOverdue ? '#C4785C' : 'var(--color-text-secondary)', margin: 0 }}>
                    {p.due_date ? `Due ${p.due_date}` : 'No due date'}
                  </p>
                </div>
                <span className="currency currency-xs" style={{ color: 'var(--color-text-primary)', flexShrink: 0 }}>
                  ${p.amount.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <button onClick={() => navigate('/finances')} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0 0', display: 'block', textAlign: 'left' }}>
        View all →
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [couple, setCouple]               = useState<Couple | null>(null)
  const [vendors, setVendors]             = useState<Vendor[]>([])
  const [payments, setPayments]           = useState<Payment[]>([])
  const [tasks, setTasks]                 = useState<Task[]>([])
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({})
  const [categorySlugs, setCategorySlugs] = useState<string[]>([])
  const [loading, setLoading]             = useState(true)
  const [partnerEmail, setPartnerEmail]   = useState('')
  const [inviting, setInviting]           = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem('veil_setup_card_dismissed') === '1'
  )
  const [dateDismissed, setDateDismissed] = useState(
    () => localStorage.getItem('veil_date_nudge_dismissed') === '1'
  )
  const navigate = useNavigate()
  const location = useLocation()
  // Set by onboarding step 4. Held in state so dismissing it doesn't depend on
  // mutating router state, and cleared from history so a refresh won't replay it.
  const [celebrating, setCelebrating] = useState(
    () => Boolean((location.state as { justOnboarded?: boolean } | null)?.justOnboarded)
  )

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const c = await getCoupleForUser(user.id)
        if (!c) { setLoading(false); return }
        // Back-fill budget_range from budget_total for pre-onboarding-redesign users
        if (c.budget_total && !c.budget_range) {
          const derived = deriveBudgetRange(c.budget_total)
          updateCouple(c.id, { budget_range: derived }).catch(() => {})
          c.budget_range = derived
        }
        setCouple(c)
        const cats = await getCategoriesForCouple(c.id)
        const labels: Record<string, string> = {}
        for (const cat of cats) labels[cat.slug] = cat.label
        setCategoryLabels(labels)
        setCategorySlugs(cats.map(cat => cat.slug))
        await seedDefaultVendorCategories(c.id, cats.map(cat => cat.slug))
        const [v, p, t] = await Promise.all([
          getVendorsForCouple(c.id),
          getPaymentsForCouple(c.id),
          getTasksForCouple(c.id),
        ])
        setVendors(v)
        setPayments(p)
        setTasks(t)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleInvitePartner() {
    if (!couple || !partnerEmail) return
    setInviting(true)
    try {
      const { error } = await supabase.functions.invoke('invite-partner', {
        body: { couple_id: couple.id, partner_email: partnerEmail },
      })
      if (error) throw error
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const updated = await getCoupleForUser(user.id)
        if (updated) setCouple(updated)
      }
      setInviteSuccess(true)
    } catch (err) {
      console.error('Invite failed:', err)
    } finally {
      setInviting(false)
    }
  }

  const daysUntil = couple?.wedding_date
    ? Math.ceil((new Date(couple.wedding_date).getTime() - Date.now()) / 86400000)
    : null

  const bookedVendors  = vendors.filter(v => v.status === 'booked')
  const activeVendors  = vendors.filter(v => v.status !== 'not_started' && v.status !== 'eliminated')
  const totalPaid      = payments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0)
  const today          = new Date().toISOString().split('T')[0]
  const pendingTasks   = tasks.filter(t => !t.completed)
  const overdueTasks   = pendingTasks.filter(t => t.due_date && t.due_date < today)
  const completedTasks = tasks.filter(t => t.completed)

  const totalCategories = categorySlugs.length
  const bookedCatCount  = categorySlugs.filter(s => vendors.some(v => v.category === s && v.status === 'booked')).length

  const budgetPct  = couple?.budget_total
    ? Math.min(100, Math.round((bookedVendors.reduce((s, v) => s + (v.booked_amount ?? 0), 0) / couple.budget_total) * 100))
    : 0
  const paidPct    = couple?.budget_total
    ? Math.min(100, Math.round((totalPaid / couple.budget_total) * 100))
    : 0
  const vendorPct  = activeVendors.length > 0
    ? Math.round((bookedVendors.length / activeVendors.length) * 100)
    : 0
  const taskPct    = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0

  // Per-category status for the segmented bar
  const STATUS_PRIORITY: Record<string, number> = {
    booked: 4, meeting_scheduled: 3, shortlisted: 2, researching: 1, not_started: 0,
  }
  const vendorStatusBySlug: Record<string, string> = {}
  for (const v of vendors) {
    if (v.status === 'eliminated') continue
    const current = vendorStatusBySlug[v.category]
    const vPri    = STATUS_PRIORITY[v.status] ?? 0
    const cPri    = current ? (STATUS_PRIORITY[current] ?? 0) : -1
    if (!current || vPri > cPri) vendorStatusBySlug[v.category] = v.status
  }

  const actionCards     = generateActionCards(daysUntil, couple, vendors, categorySlugs, categoryLabels, tasks, payments)
  const contextualStatus = getContextualStatus(daysUntil, bookedCatCount, totalCategories, overdueTasks.length, couple?.city)

  // Vendor categories needing attention (not started)
  const needsAttention  = categorySlugs.filter(s => (vendorStatusBySlug[s] ?? 'not_started') === 'not_started')
  const shownAttention  = needsAttention.slice(0, 5)
  const moreAttention   = needsAttention.length - shownAttention.length

  const coupleName = couple?.name_primary
    ? `${couple.name_primary}${couple.name_partner ? ` & ${couple.name_partner}` : ''}`
    : ''

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      {celebrating && (
        <WelcomeCelebration
          coupleName={coupleName}
          daysUntil={daysUntil}
          weddingDate={couple?.wedding_date ?? null}
          onDismiss={() => {
            setCelebrating(false)
            window.history.replaceState({}, '')
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 6px 0', fontWeight: 600 }}>
          Overview
        </p>
        {couple?.name_primary ? (
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', fontWeight: 400, margin: '0 0 4px 0', lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
            {couple.name_primary}
            {couple.name_partner && <> <span style={{ color: 'var(--color-accent)' }}>&</span> {couple.name_partner}</>}
          </h1>
        ) : (
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', fontWeight: 400, margin: '0 0 4px 0', lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
            {daysUntil !== null ? <><span style={{ color: 'var(--color-accent)' }}>{daysUntil} days</span> to go</> : 'Welcome to Veil'}
          </h1>
        )}
        {daysUntil !== null && couple?.name_primary && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
            {daysUntil} days to go
          </p>
        )}
        <AiAdvisorCard text={contextualStatus} />
      </div>

      {/* ── Setup card ─────────────────────────────────────────────── */}
      {couple && !setupDismissed && (!couple.guest_count || (!couple.budget_total && !couple.budget_range)) && (
        <div style={{
          background: '#FBF6F0',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-accent)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
              Complete your setup
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Still missing:{' '}
              {[
                !couple.guest_count && 'guest count',
                (!couple.budget_total && !couple.budget_range) && 'budget',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600,
              color: 'var(--color-accent)', background: 'rgba(200,169,110,0.12)',
              border: '1px solid rgba(200,169,110,0.3)', borderRadius: '8px',
              padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Complete Setup →
          </button>
          <button
            onClick={() => { setSetupDismissed(true); localStorage.setItem('veil_setup_card_dismissed', '1') }}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Lock in date nudge ─────────────────────────────────────── */}
      {couple && couple.target_season && !dateDismissed && (
        <div style={{
          background: '#FBF6F0',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-accent)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
              Lock in your exact date
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              You're planning for {couple.target_season} {couple.target_year ?? ''}. Add an exact date to sharpen your timeline and vendor availability windows.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600,
              color: 'var(--color-accent)', background: 'rgba(200,169,110,0.12)',
              border: '1px solid rgba(200,169,110,0.3)', borderRadius: '8px',
              padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Add Date →
          </button>
          <button
            onClick={() => { setDateDismissed(true); localStorage.setItem('veil_date_nudge_dismissed', '1') }}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Action cards ───────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px 0' }}>
          This week
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {actionCards.map((card, i) => (
            <ActionCardView key={i} card={card} navigate={navigate} />
          ))}
        </div>
      </div>

      {/* ── Compact stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:flex gap-[10px]" style={{ marginBottom: '20px' }}>
        <CompactStatCard
          label="Budget"
          value={couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : '—'}
          sub={couple?.budget_total ? `${budgetPct}% committed` : 'Set in Settings'}
          pct={budgetPct}
          onClick={() => navigate('/budget')}
          valueClassName="currency currency-sm"
        />
        <CompactStatCard
          label="Paid"
          value={totalPaid === 0 ? '$0' : `$${Math.round(totalPaid / 1000)}K`}
          sub={`${paidPct}% of budget`}
          pct={paidPct}
          onClick={() => navigate('/finances')}
          valueClassName="currency currency-sm"
        />
        <CompactStatCard
          label="Vendors"
          value={`${bookedVendors.length}/${activeVendors.length}`}
          sub="booked"
          pct={vendorPct}
          onClick={() => navigate('/vendors')}
        />
        <CompactStatCard
          label="Tasks"
          value={`${pendingTasks.length}`}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : `${completedTasks.length} done`}
          pct={taskPct}
          onClick={() => navigate('/todos')}
        />
      </div>

      {/* ── Budget breakdown + upcoming payments ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-[14px]" style={{ marginBottom: '20px' }}>
        <BudgetBreakdownCard vendors={vendors} categoryLabels={categoryLabels} />
        <UpcomingPaymentsCard payments={payments} navigate={navigate} />
      </div>

      {/* ── Vendor status — segmented bar ──────────────────────────── */}
      {categorySlugs.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(140,120,100,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, margin: 0 }}>
              Vendor Status
            </p>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {bookedCatCount} of {totalCategories} booked
            </span>
          </div>

          {/* Segmented bar */}
          <div style={{ display: 'flex', gap: '2px', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
            {categorySlugs.map(slug => {
              const status = vendorStatusBySlug[slug] ?? 'not_started'
              const bg = status === 'booked'
                ? '#7B8F6B'
                : ['researching', 'shortlisted', 'meeting_scheduled'].includes(status)
                ? '#C4A86B'
                : '#E8E3DC'
              return <div key={slug} style={{ flex: 1, background: bg }} />
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: needsAttention.length > 0 ? '12px' : '0' }}>
            {[
              { color: '#7B8F6B', label: `Booked (${bookedCatCount})` },
              { color: '#C4A86B', label: `In progress (${categorySlugs.filter(s => ['researching','shortlisted','meeting_scheduled'].includes(vendorStatusBySlug[s] ?? '')).length})` },
              { color: '#E8E3DC', label: `Not started (${needsAttention.length})`, textColor: '#AAA5A0' },
            ].map(({ color, label, textColor }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: textColor ?? 'var(--color-text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Needs attention */}
          {needsAttention.length > 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {needsAttention.length} {needsAttention.length === 1 ? 'category' : 'categories'} need action:
              </span>{' '}
              {shownAttention.map(s => categoryLabels[s] ?? s).join(' · ')}
              {moreAttention > 0 && <span style={{ color: 'var(--color-text-muted)' }}> +{moreAttention} more</span>}
            </p>
          )}

          <button
            onClick={() => navigate('/vendors')}
            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View all vendors →
          </button>
        </div>
      )}

      {/* ── Partner invite ─────────────────────────────────────────── */}
      {couple && !couple.email_partner && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(140,120,100,0.06)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>Invite your partner</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Plan together in real time</p>
          </div>
          {inviteSuccess ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', margin: 0 }}>Invite sent!</p>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="partner@email.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                style={{ width: '220px', padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}
              />
              <button
                onClick={handleInvitePartner}
                disabled={inviting || !partnerEmail}
                style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: inviting || !partnerEmail ? 'default' : 'pointer', opacity: !partnerEmail ? 0.6 : 1 }}
              >
                {inviting ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}

    </AppShell>
  )
}
