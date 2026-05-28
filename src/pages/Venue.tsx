import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import StatusBadge from '../components/StatusBadge'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple } from '../lib/payments'
import type { Vendor, Payment } from '../types/database'

export default function Venue() {
  const [venue, setVenue] = useState<Vendor | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const couple = await getCoupleForUser(user.id)
        if (!couple) return
        const [vendors, allPayments] = await Promise.all([
          getVendorsForCouple(couple.id),
          getPaymentsForCouple(couple.id),
        ])
        const v = vendors.find(v => v.category === 'venue') ?? null
        setVenue(v)
        if (v) setPayments(allPayments.filter(p => p.vendor_id === v.id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  if (!venue || venue.status === 'not_started') {
    return (
      <AppShell>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
            Venue
          </p>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '38px', fontWeight: 400, marginBottom: '12px' }}>
            Find your venue
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontSize: '15px', marginBottom: '28px', lineHeight: 1.6 }}>
            Your venue sets the tone for everything — the guest count, the catering, the florals. Start here.
          </p>
          <Button onClick={() => navigate('/vendors/venue')}>Find Venues with AI</Button>
        </div>
      </AppShell>
    )
  }

  const totalPaid = payments.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
  const totalCost = venue.booked_amount ?? 0
  const remaining = totalCost - totalPaid
  const paidPercent = totalCost > 0 ? Math.min(100, Math.round((totalPaid / totalCost) * 100)) : 0
  const sortedPayments = [...payments].sort((a, b) => {
    // paid first (by paid_date desc), then upcoming (by due_date asc)
    if (a.paid_date && !b.paid_date) return -1
    if (!a.paid_date && b.paid_date) return 1
    if (a.paid_date && b.paid_date) return b.paid_date.localeCompare(a.paid_date)
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  return (
    <AppShell>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
          Venue
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '38px', fontWeight: 400, lineHeight: 1.15, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
              {venue.name ?? 'Your Venue'}
            </h1>
            {venue.notes && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {venue.notes}
              </p>
            )}
          </div>
          <StatusBadge status={venue.status} />
        </div>

        {/* Financial summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: 'Total Cost', value: totalCost > 0 ? `$${totalCost.toLocaleString()}` : '—' },
            { label: 'Paid', value: totalCost > 0 ? `$${totalPaid.toLocaleString()}` : '—' },
            { label: 'Remaining', value: remaining > 0 ? `$${remaining.toLocaleString()}` : (totalCost > 0 ? 'Paid off' : '—') },
          ].map(({ label, value }) => (
            <Card key={label}>
              <SectionLabel>{label}</SectionLabel>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', margin: 0 }}>{value}</p>
            </Card>
          ))}
        </div>

        {totalCost > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ height: '6px', background: '#f0ebe4', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${paidPercent}%`,
                background: paidPercent >= 100 ? 'var(--color-status-booked)' : 'var(--color-accent)',
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
              {paidPercent}% paid
            </p>
          </div>
        )}

        {/* Contact info */}
        {(venue.contact_name || venue.contact_email || venue.contact_phone || venue.website) && (
          <Card style={{ marginBottom: '20px' }}>
            <SectionLabel>Contact</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {venue.contact_name && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', width: '72px', flexShrink: 0 }}>Name</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)' }}>{venue.contact_name}</span>
                </div>
              )}
              {venue.contact_email && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', width: '72px', flexShrink: 0 }}>Email</span>
                  <a href={`mailto:${venue.contact_email}`} style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-accent)', textDecoration: 'none' }}>{venue.contact_email}</a>
                </div>
              )}
              {venue.contact_phone && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', width: '72px', flexShrink: 0 }}>Phone</span>
                  <a href={`tel:${venue.contact_phone}`} style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-accent)', textDecoration: 'none' }}>{venue.contact_phone}</a>
                </div>
              )}
              {venue.website && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', width: '72px', flexShrink: 0 }}>Website</span>
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                    {venue.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Payments */}
        {sortedPayments.length > 0 && (
          <Card>
            <SectionLabel>Payments</SectionLabel>
            <div style={{ marginTop: '8px' }}>
              {sortedPayments.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--color-bg)' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)', margin: '0 0 3px 0' }}>{p.label}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {p.paid_date ? `Paid ${p.paid_date}` : p.due_date ? `Due ${p.due_date}` : 'No date set'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', color: 'var(--color-text-primary)', margin: '0 0 3px 0' }}>${p.amount.toLocaleString()}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', margin: 0, color: p.paid_date ? 'var(--color-status-booked)' : 'var(--color-text-secondary)', fontWeight: p.paid_date ? 600 : 400 }}>
                      {p.paid_date ? '✓ Paid' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" onClick={() => navigate('/finances')} style={{ marginTop: '14px' }}>
              All finances →
            </Button>
          </Card>
        )}

        {sortedPayments.length === 0 && venue.status === 'booked' && (
          <Card>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
              No payments recorded yet. Add them in <button onClick={() => navigate('/finances')} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '14px', padding: 0, textDecoration: 'underline' }}>Finances</button>.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
