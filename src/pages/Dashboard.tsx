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
import { type Couple, type Vendor, type Payment, VENDOR_CATEGORY_LABELS } from '../types/database'

export default function Dashboard() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }
        const c = await getCoupleForUser(user.id)
        if (!c) {
          setLoading(false)
          return
        }
        setCouple(c)
        await seedDefaultVendorCategories(c.id)
        const [v, p] = await Promise.all([
          getVendorsForCouple(c.id),
          getPaymentsForCouple(c.id),
        ])
        setVendors(v)
        setPayments(p)
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
      // Reload couple to show updated email_partner
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

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
        Your Dashboard
      </p>

      {/* Countdown */}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 400, marginBottom: '24px', color: 'var(--color-text-primary)' }}>
        {daysUntil !== null ? (
          <><span style={{ color: 'var(--color-accent)' }}>{daysUntil} days</span> until your wedding</>
        ) : (
          'Welcome to Veil'
        )}
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <Card>
          <SectionLabel>Budget</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', margin: '0 0 4px 0' }}>
            {couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : '—'}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', margin: 0 }}>
            {couple?.budget_total ? `${Math.round((totalCommitted / couple.budget_total) * 100)}% committed` : 'Set a budget'}
          </p>
        </Card>
        <Card>
          <SectionLabel>Paid</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', margin: '0 0 4px 0' }}>
            ${(totalPaid / 1000).toFixed(1)}K
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', margin: 0 }}>
            {couple?.budget_total ? `${Math.round((totalPaid / couple.budget_total) * 100)}% of total` : ''}
          </p>
        </Card>
        <Card>
          <SectionLabel>Vendors</SectionLabel>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', margin: '0 0 4px 0' }}>
            {bookedVendors.length} / {vendors.length}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', margin: 0 }}>
            booked
          </p>
        </Card>
      </div>

      {/* Partner invite — shown only when no partner is linked yet */}
      {couple && !couple.email_partner && (
        <Card style={{ marginBottom: '24px' }}>
          <SectionLabel>Invite Your Partner</SectionLabel>
          {inviteSuccess ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', margin: '8px 0 0 0' }}>
              Invite sent! Your partner will receive a magic link by email.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="email"
                placeholder="partner@email.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              <Button
                onClick={handleInvitePartner}
                disabled={inviting || !partnerEmail}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Vendor status */}
        <Card>
          <SectionLabel>Vendor Status</SectionLabel>
          {vendors.slice(0, 8).map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-bg)' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                {VENDOR_CATEGORY_LABELS[v.category as keyof typeof VENDOR_CATEGORY_LABELS] ?? v.category}
                {v.name && <span style={{ color: 'var(--color-text-secondary)' }}> — {v.name}</span>}
              </span>
              <StatusBadge status={v.status} />
            </div>
          ))}
          <Button variant="ghost" onClick={() => navigate('/vendors')} style={{ marginTop: '12px' }}>
            View all vendors →
          </Button>
        </Card>

        {/* Upcoming payments */}
        <Card>
          <SectionLabel>Upcoming Payments</SectionLabel>
          {upcoming.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              No upcoming payments
            </p>
          ) : upcoming.map(p => (
            <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)' }}>{p.label}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)' }}>${p.amount.toLocaleString()}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Due {p.due_date}
              </p>
            </div>
          ))}
          <Button variant="ghost" onClick={() => navigate('/finances')} style={{ marginTop: '12px' }}>
            View all payments →
          </Button>
        </Card>
      </div>

      <div style={{ marginTop: '24px' }}>
        <Button onClick={() => navigate('/timeline')}>
          Check My Timeline
        </Button>
      </div>
    </AppShell>
  )
}
