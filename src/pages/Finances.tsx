import { useEffect, useState, type CSSProperties } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple, insertPayment, markPaymentPaid, deletePayment } from '../lib/payments'
import type { Couple, Vendor, Payment } from '../types/database'
import { track } from '../lib/analytics'

type Tab = 'upcoming' | 'by_family'

export default function Finances() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tab, setTab] = useState<Tab>('upcoming')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPayment, setNewPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple', vendor_id: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const [v, p] = await Promise.all([getVendorsForCouple(c.id), getPaymentsForCouple(c.id)])
      setVendors(v)
      setPayments(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAddPayment() {
    if (!couple) return
    setSaving(true)
    try {
      await insertPayment({
        couple_id: couple.id,
        vendor_id: newPayment.vendor_id || null,
        label: newPayment.label,
        amount: Number(newPayment.amount),
        due_date: newPayment.due_date || null,
        paid_date: null,
        paid_by: newPayment.paid_by,
        notes: null,
      })
      setShowAddForm(false)
      setNewPayment({ label: '', amount: '', due_date: '', paid_by: 'couple', vendor_id: '' })
      await load()
    } catch {
      alert('Failed to add payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkPaid(paymentId: string) {
    try {
      const p = payments.find(p => p.id === paymentId)
      await markPaymentPaid(paymentId, new Date().toISOString().split('T')[0])
      if (p) track('payment_marked_paid', { amount: p.amount })
      await load()
    } catch {
      alert('Failed to mark payment as paid. Please try again.')
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = payments.filter(p => !p.paid_date && (!p.due_date || p.due_date >= today))
  const past = payments.filter(p => p.paid_date)
  const payerGroups = payments.reduce((acc, p) => {
    const payer = p.paid_by || 'couple'
    if (!acc[payer]) acc[payer] = []
    acc[payer].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  const inputStyle: CSSProperties = {
    display: 'block',
  }

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, marginBottom: '28px' }}>
        Finances
      </h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {(['upcoming', 'by_family'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 20px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: tab === t ? 600 : 400,
            background: tab === t ? 'rgba(200,169,110,0.12)' : 'transparent',
            border: tab === t ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
            borderRadius: '10px',
            color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.12s',
            width: 'auto',
            boxSizing: 'border-box',
          }}>
            {t === 'upcoming' ? 'Upcoming' : 'By Family'}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        <>
          {upcoming.length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              No upcoming payments. Add one below.
            </p>
          )}
          {upcoming.map(p => {
            const vendor = vendors.find(v => v.id === p.vendor_id)
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>
                    {p.label}{vendor?.name ? ` — ${vendor.name}` : ''}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Due {p.due_date} · Paid by {p.paid_by}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                    ${p.amount.toLocaleString()}
                  </span>
                  <Button variant="secondary" onClick={() => handleMarkPaid(p.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Mark Paid
                  </Button>
                  <button onClick={async () => {
                    if (confirm('Remove?')) {
                      try {
                        await deletePayment(p.id)
                        await load()
                      } catch {
                        alert('Failed to remove payment. Please try again.')
                      }
                    }
                  }} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-status-none)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}

          {past.length > 0 && (
            <>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '24px 0 8px 0' }}>
                Paid
              </p>
              {past.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-bg)', opacity: 0.6 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', margin: 0 }}>{p.label}</p>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-status-booked)' }}>
                    ${p.amount.toLocaleString()} ✓
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'by_family' && (
        <>
          {Object.entries(payerGroups).map(([payer, items]) => {
            const total = items.reduce((sum, p) => sum + p.amount, 0)
            const paid = items.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0)
            return (
              <Card key={payer} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', margin: 0 }}>
                    {payer.replace('_', "'s ").replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', margin: 0 }}>${total.toLocaleString()}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-status-booked)', margin: 0 }}>${paid.toLocaleString()} paid</p>
                  </div>
                </div>
                {items.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--color-bg)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{p.label}</p>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', margin: 0, color: p.paid_date ? 'var(--color-status-booked)' : 'var(--color-text-primary)' }}>
                      ${p.amount.toLocaleString()}{p.paid_date ? ' ✓' : ''}
                    </p>
                  </div>
                ))}
              </Card>
            )
          })}
          {Object.keys(payerGroups).length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              No payments recorded yet.
            </p>
          )}
        </>
      )}

      {showAddForm ? (
        <Card style={{ marginTop: '16px' }}>
          <SectionLabel>Add Payment</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Label</label>
              <input placeholder="Deposit" value={newPayment.label} onChange={e => setNewPayment(f => ({ ...f, label: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Amount ($)</label>
              <input type="number" value={newPayment.amount} onChange={e => setNewPayment(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Due Date</label>
              <input type="date" value={newPayment.due_date} onChange={e => setNewPayment(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Paid By</label>
              <input placeholder="couple" value={newPayment.paid_by} onChange={e => setNewPayment(f => ({ ...f, paid_by: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Vendor (optional)</label>
              <select value={newPayment.vendor_id} onChange={e => setNewPayment(f => ({ ...f, vendor_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                <option value="">— None —</option>
                {vendors.filter(v => v.name).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={saving || !newPayment.label || !newPayment.amount}>
              {saving ? 'Saving...' : 'Add Payment'}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setShowAddForm(true)} style={{ marginTop: '16px' }}>
          + Add Payment
        </Button>
      )}
    </AppShell>
  )
}
