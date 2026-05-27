import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { getPaymentsForCouple, getUpcomingPayments } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { type Couple, type Vendor, type Payment, type Task } from '../types/database'
import { getCategoriesForCouple } from '../lib/categories'
import StatusBadge from '../components/StatusBadge'

// ── Stat strip icon SVGs ───────────────────────────────────────────────────

function BudgetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}
function VendorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function TaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}
function PaidIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: '14px',
      display: 'flex',
      marginBottom: '28px',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function StatCell({
  icon, label, value, sub, accent, onClick, last,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: boolean
  onClick?: () => void
  last?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: '18px 20px',
        borderRight: last ? 'none' : '1px solid var(--color-border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.12s',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = '#faf7f5' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
        {icon}
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: accent ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)',
      fontSize: '10px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--color-text-secondary)',
      fontWeight: 600,
      margin: '0 0 10px 0',
    }}>
      {children}
    </p>
  )
}

function Panel({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({})
  const [latestInsight, setLatestInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const c = await getCoupleForUser(user.id)
        if (!c) { setLoading(false); return }
        setCouple(c)
        const cats = await getCategoriesForCouple(c.id)
        const labels: Record<string, string> = {}
        for (const cat of cats) labels[cat.slug] = cat.label
        setCategoryLabels(labels)
        await seedDefaultVendorCategories(c.id, cats.map(cat => cat.slug))
        const [v, p, t, insight] = await Promise.all([
          getVendorsForCouple(c.id),
          getPaymentsForCouple(c.id),
          getTasksForCouple(c.id),
          supabase
            .from('ai_insights')
            .select('content')
            .eq('couple_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        setVendors(v)
        setPayments(p)
        setTasks(t)
        if (insight.data) setLatestInsight(insight.data.content)
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

  const bookedVendors = vendors.filter(v => v.status === 'booked')
  const activeVendors = vendors.filter(v => v.status !== 'not_started' && v.status !== 'eliminated')
  const totalCommitted = bookedVendors.reduce((sum, v) => sum + (v.booked_amount ?? 0), 0)
  const totalPaid = payments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0)
  const upcoming = getUpcomingPayments(payments)
  const today = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => !t.completed)
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today)
  const upcomingTasks = pendingTasks.slice(0, 5)

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      {/* Page heading */}
      <div style={{ marginBottom: '22px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 6px 0', fontWeight: 600 }}>
          Overview
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 400, margin: 0, lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
          {daysUntil !== null ? (
            <><span style={{ color: 'var(--color-accent)' }}>{daysUntil} days</span> to go</>
          ) : (
            'Welcome to Veil'
          )}
        </h1>
      </div>

      {/* Stats strip */}
      <StatStrip>
        <StatCell
          icon={<BudgetIcon />}
          label="Budget"
          value={couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : '—'}
          sub={couple?.budget_total ? `${Math.round((totalCommitted / couple.budget_total) * 100)}% committed` : 'Set in Budget'}
          accent
          onClick={() => navigate('/budget')}
        />
        <StatCell
          icon={<PaidIcon />}
          label="Paid"
          value={`$${(totalPaid / 1000).toFixed(1)}K`}
          sub={couple?.budget_total ? `${Math.round((totalPaid / couple.budget_total) * 100)}% of total` : 'total paid'}
          accent
          onClick={() => navigate('/finances')}
        />
        <StatCell
          icon={<VendorIcon />}
          label="Vendors"
          value={`${bookedVendors.length} / ${activeVendors.length}`}
          sub="booked"
          accent
          onClick={() => navigate('/vendors')}
        />
        <StatCell
          icon={<TaskIcon />}
          label="Tasks"
          value={`${pendingTasks.length}`}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'remaining'}
          accent={overdueTasks.length === 0}
          onClick={() => navigate('/todos')}
          last
        />
      </StatStrip>

      {/* AI Planning Advisor */}
      <div style={{
        marginBottom: '24px',
        borderRadius: '14px',
        border: '1px solid rgba(196,120,138,0.20)',
        background: 'linear-gradient(135deg, rgba(196,120,138,0.05) 0%, #fff 60%)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600, margin: '0 0 6px 0' }}>
            AI Planning Advisor
          </p>
          {latestInsight ? (
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: 0 }}>
              "{latestInsight}"
            </p>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Get a personalized assessment — what's done, what's urgent, what's next.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <Button onClick={() => navigate('/timeline')} style={{ borderRadius: '10px' }}>
            {latestInsight ? 'Refresh' : 'Check Timeline'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/vendors')} style={{ borderRadius: '10px' }}>
            Find Vendors
          </Button>
        </div>
      </div>

      {/* Partner invite */}
      {couple && !couple.email_partner && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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
                style={{ width: '220px', padding: '8px 12px', fontSize: '13px', borderRadius: '10px' }}
              />
              <Button onClick={handleInvitePartner} disabled={inviting || !partnerEmail}>
                {inviting ? 'Sending…' : 'Send'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3-column detail panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

        {/* Vendor status */}
        <Panel>
          <SectionHeader>Vendor Status</SectionHeader>
          {vendors.filter(v => v.status !== 'not_started').slice(0, 8).map(v => (
            <div key={v.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid #f5f2ef',
            }}>
              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: 0, fontWeight: 500 }}>
                  {categoryLabels[v.category] ?? v.category}
                </p>
                {v.name && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '1px 0 0 0' }}>
                    {v.name}
                  </p>
                )}
              </div>
              <StatusBadge status={v.status} />
            </div>
          ))}
          {vendors.filter(v => v.status === 'not_started').length === vendors.length && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0 0 0' }}>
              No vendors started yet
            </p>
          )}
          <button
            onClick={() => navigate('/vendors')}
            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0 0', display: 'block' }}
          >
            View all vendors →
          </button>
        </Panel>

        {/* Upcoming payments */}
        <Panel>
          <SectionHeader>Upcoming Payments</SectionHeader>
          {upcoming.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              No upcoming payments
            </p>
          ) : upcoming.map(p => (
            <div key={p.id} style={{ padding: '9px 0', borderBottom: '1px solid #f5f2ef' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{p.label}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)' }}>${p.amount.toLocaleString()}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                {p.due_date ? `Due ${p.due_date}` : 'No due date'}
              </p>
            </div>
          ))}
          <button
            onClick={() => navigate('/finances')}
            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0 0', display: 'block' }}
          >
            View all payments →
          </button>
        </Panel>

        {/* Upcoming tasks */}
        <Panel>
          <SectionHeader>Tasks</SectionHeader>
          {upcomingTasks.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              No pending tasks
            </p>
          ) : upcomingTasks.map(t => {
            const isOverdue = t.due_date && t.due_date < today
            return (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f2ef', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', border: '2px solid var(--color-border)', flexShrink: 0, marginTop: '5px' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 1px 0', fontWeight: 500 }}>{t.title}</p>
                  {t.due_date && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: isOverdue ? '#B91C1C' : 'var(--color-text-secondary)', margin: 0, fontWeight: isOverdue ? 600 : 400 }}>
                      {isOverdue ? '⚠ ' : ''}Due {t.due_date}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <button
            onClick={() => navigate('/todos')}
            style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0 0', display: 'block' }}
          >
            View all tasks →
          </button>
        </Panel>
      </div>
    </AppShell>
  )
}
