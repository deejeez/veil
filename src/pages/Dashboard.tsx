import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { getPaymentsForCouple } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { type Couple, type Vendor, type Payment, type Task } from '../types/database'
import { getCategoriesForCouple } from '../lib/categories'
import StatusBadge from '../components/StatusBadge'

// ── Donut ring ─────────────────────────────────────────────────────────────

function DonutRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct / 100)))
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE8E4" strokeWidth="4.5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--color-accent)" strokeWidth="4.5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, pct, onClick }: {
  label: string; value: string; sub?: string; pct: number; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        minWidth: 0,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <DonutRing pct={pct} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, margin: '0 0 3px 0' }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 2px 0' }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: '10px',
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--color-text-secondary)', fontWeight: 600, margin: '0 0 14px 0',
    }}>
      {children}
    </p>
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
  const today = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => !t.completed)
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today)
  const completedTasks = tasks.filter(t => t.completed)

  const budgetPct = couple?.budget_total
    ? Math.min(100, Math.round((totalCommitted / couple.budget_total) * 100))
    : 0
  const paidPct = couple?.budget_total
    ? Math.min(100, Math.round((totalPaid / couple.budget_total) * 100))
    : 0
  const vendorPct = activeVendors.length > 0
    ? Math.round((bookedVendors.length / activeVendors.length) * 100)
    : 0
  const taskPct = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      {/* Page heading */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 6px 0', fontWeight: 600 }}>
          Overview
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', fontWeight: 400, margin: 0, lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
          {daysUntil !== null ? (
            <><span style={{ color: 'var(--color-accent)' }}>{daysUntil} days</span> to go</>
          ) : (
            'Welcome to Veil'
          )}
        </h1>
      </div>

      {/* Stat cards with donut rings */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <StatCard
          label="Budget"
          value={couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : '—'}
          sub={couple?.budget_total ? `${budgetPct}% committed` : 'Set in Budget'}
          pct={budgetPct}
          onClick={() => navigate('/budget')}
        />
        <StatCard
          label="Paid"
          value={`$${(totalPaid / 1000).toFixed(1)}K`}
          sub={`${paidPct}% of budget`}
          pct={paidPct}
          onClick={() => navigate('/finances')}
        />
        <StatCard
          label="Vendors"
          value={`${bookedVendors.length} / ${activeVendors.length}`}
          sub="booked"
          pct={vendorPct}
          onClick={() => navigate('/vendors')}
        />
        <StatCard
          label="Tasks"
          value={`${pendingTasks.length}`}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : `${completedTasks.length} done`}
          pct={taskPct}
          onClick={() => navigate('/todos')}
        />
      </div>

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
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
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
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
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

      {/* Vendor status — grid layout, full width now that payments/tasks live in RightPanel */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <SectionHeader>Vendor Status</SectionHeader>
        {vendors.filter(v => v.status !== 'not_started').length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            No vendors started yet
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
            {vendors.filter(v => v.status !== 'not_started').map(v => (
              <div key={v.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                background: '#faf8f6',
                borderRadius: '10px',
                border: '1px solid #f0ebe6',
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
          </div>
        )}
        <button
          onClick={() => navigate('/vendors')}
          style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0 0 0', display: 'block' }}
        >
          View all vendors →
        </button>
      </div>
    </AppShell>
  )
}
