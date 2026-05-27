import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import StatusBadge from '../components/StatusBadge'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { getPaymentsForCouple, getUpcomingPayments } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { type Couple, type Vendor, type Payment, type Task } from '../types/database'
import { getCategoriesForCouple } from '../lib/categories'

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
        await seedDefaultVendorCategories(c.id, cats.map(c => c.slug))
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
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
        Your Dashboard
      </p>

      {/* Countdown */}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '42px', fontWeight: 400, marginBottom: '28px', lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
        {daysUntil !== null ? (
          <><span style={{ color: 'var(--color-accent)' }}>{daysUntil} days</span> until your wedding</>
        ) : (
          'Welcome to Veil'
        )}
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card onClick={() => navigate('/budget')} style={{ cursor: 'pointer' }}>
          <SectionLabel>Budget</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', margin: '0 0 4px 0', lineHeight: 1.2 }}>
            {couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : '—'}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', margin: '0 0 8px 0' }}>
            {couple?.budget_total ? `${Math.round((totalCommitted / couple.budget_total) * 100)}% committed` : 'Set in Budget'}
          </p>
          {couple?.budget_total && couple.budget_total > 0 && (
            <div style={{ height: '3px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((totalCommitted / couple.budget_total) * 100))}%`, background: 'var(--color-accent)', borderRadius: '2px' }} />
            </div>
          )}
        </Card>
        <Card onClick={() => navigate('/finances')} style={{ cursor: 'pointer' }}>
          <SectionLabel>Paid</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', margin: '0 0 4px 0', lineHeight: 1.2 }}>
            ${(totalPaid / 1000).toFixed(1)}K
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', margin: '0 0 8px 0' }}>
            {couple?.budget_total ? `${Math.round((totalPaid / couple.budget_total) * 100)}% of total` : 'total paid'}
          </p>
          {couple?.budget_total && couple.budget_total > 0 && (
            <div style={{ height: '3px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((totalPaid / couple.budget_total) * 100))}%`, background: 'var(--color-status-booked)', borderRadius: '2px' }} />
            </div>
          )}
        </Card>
        <Card onClick={() => navigate('/vendors')} style={{ cursor: 'pointer' }}>
          <SectionLabel>Vendors</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', margin: '0 0 4px 0', lineHeight: 1.2 }}>
            {bookedVendors.length}<span style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}> / {vendors.filter(v => v.status !== 'not_started').length}</span>
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', margin: '0 0 8px 0' }}>
            booked
          </p>
          {vendors.filter(v => v.status !== 'not_started').length > 0 && (
            <div style={{ height: '3px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((bookedVendors.length / vendors.filter(v => v.status !== 'not_started').length) * 100))}%`, background: 'var(--color-accent)', borderRadius: '2px' }} />
            </div>
          )}
        </Card>
        <Card style={{ cursor: 'pointer' }} onClick={() => navigate('/todos')}>
          <SectionLabel>Tasks</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', margin: '0 0 4px 0', lineHeight: 1.2 }}>
            {pendingTasks.length}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: overdueTasks.length > 0 ? '#B91C1C' : 'var(--color-accent)', margin: '0 0 8px 0', fontWeight: overdueTasks.length > 0 ? 600 : 400 }}>
            {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'remaining'}
          </p>
          <div style={{ height: '3px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: overdueTasks.length > 0 ? '100%' : '0%', background: '#B91C1C', borderRadius: '2px', display: overdueTasks.length > 0 ? 'block' : 'none' }} />
          </div>
        </Card>
      </div>

      {/* AI Planning Advisor — Hero Section */}
      <div style={{
        marginBottom: '24px',
        borderRadius: '20px',
        border: '1px solid rgba(196,120,138,0.22)',
        background: 'linear-gradient(135deg, rgba(196,120,138,0.06) 0%, rgba(254,252,250,0) 60%)',
        padding: '28px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '200px', height: '200px',
          background: 'radial-gradient(circle at top right, rgba(196,120,138,0.08), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600, marginBottom: '10px' }}>
          AI Planning Advisor
        </p>
        {latestInsight ? (
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.75, margin: '0 0 22px 0', maxWidth: '620px' }}>
            "{latestInsight}"
          </p>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, color: 'var(--color-text-primary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
              Is your planning on track?
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 22px 0', lineHeight: 1.6, maxWidth: '500px' }}>
              Get a personalized assessment of where you stand — what's done, what's urgent, and what to tackle next.
            </p>
          </>
        )}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => navigate('/timeline')} style={{ borderRadius: '12px' }}>
            {latestInsight ? 'Refresh Analysis' : 'Check My Timeline'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/vendors')} style={{ borderRadius: '12px' }}>
            Find Vendors with AI
          </Button>
        </div>
      </div>

      {/* Partner invite — shown only when no partner is linked yet */}
      {couple && !couple.email_partner && (
        <Card style={{ marginBottom: '24px' }}>
          <SectionLabel>Invite Your Partner</SectionLabel>
          {inviteSuccess ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-accent)', margin: '8px 0 0 0' }}>
              Invite sent! Your partner will receive a magic link by email.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input
                type="email"
                placeholder="partner@email.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={handleInvitePartner} disabled={inviting || !partnerEmail}>
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {/* Vendor status */}
        <Card>
          <SectionLabel>Vendor Status</SectionLabel>
          {vendors.slice(0, 8).map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-bg)' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {categoryLabels[v.category] ?? v.category}
                {v.name && <span style={{ color: 'var(--color-text-secondary)' }}> — {v.name}</span>}
              </span>
              <StatusBadge status={v.status} />
            </div>
          ))}
          <Button variant="ghost" onClick={() => navigate('/vendors')} style={{ marginTop: '14px' }}>
            View all vendors →
          </Button>
        </Card>

        {/* Upcoming payments */}
        <Card>
          <SectionLabel>Upcoming Payments</SectionLabel>
          {upcoming.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              No upcoming payments
            </p>
          ) : upcoming.map(p => (
            <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)' }}>{p.label}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', color: 'var(--color-text-primary)' }}>${p.amount.toLocaleString()}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                {p.due_date ? `Due ${p.due_date}` : 'No due date'}
              </p>
            </div>
          ))}
          <Button variant="ghost" onClick={() => navigate('/finances')} style={{ marginTop: '14px' }}>
            View all payments →
          </Button>
        </Card>

        {/* Upcoming tasks */}
        <Card>
          <SectionLabel>Upcoming Tasks</SectionLabel>
          {upcomingTasks.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              No pending tasks
            </p>
          ) : upcomingTasks.map(t => {
            const isOverdue = t.due_date && t.due_date < today
            return (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid var(--color-border)', flexShrink: 0, marginTop: '4px', display: 'inline-block' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 1px 0' }}>{t.title}</p>
                  {t.due_date && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: isOverdue ? '#B91C1C' : 'var(--color-text-secondary)', margin: 0, fontWeight: isOverdue ? 600 : 400 }}>
                      {isOverdue ? '⚠ ' : ''}Due {t.due_date}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <Button variant="ghost" onClick={() => navigate('/todos')} style={{ marginTop: '14px' }}>
            View all tasks →
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
