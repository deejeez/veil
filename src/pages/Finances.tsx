import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple, insertPayment, markPaymentPaid, deletePayment } from '../lib/payments'
import type { Couple, Vendor, Payment } from '../types/database'
import { track } from '../lib/analytics'

export default function Finances() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
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
  const totalBudget = couple?.budget_total ?? 0
  const totalPaid = payments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0)
  const unpaid = payments.filter(p => !p.paid_date)
  const totalScheduled = unpaid.reduce((sum, p) => sum + p.amount, 0)
  const totalRemaining = Math.max(0, totalBudget - totalPaid - totalScheduled)
  const paidPct = totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0
  const scheduledPct = totalBudget > 0 ? Math.min((totalScheduled / totalBudget) * 100, Math.max(0, 100 - paidPct)) : 0

  const familyAName = couple?.family_a_name || 'Family A'
  const familyBName = couple?.family_b_name || 'Family B'

  const paidByLabel = (key: string): string => {
    if (key === 'family_a') return familyAName
    if (key === 'family_b') return familyBName
    return 'Couple'
  }

  const getDaysUntil = (dueDate: string) =>
    Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)

  const isOverdue = (p: Payment) => !!p.due_date && p.due_date < today && !p.paid_date
  const isDueSoon = (p: Payment) => {
    if (!p.due_date || p.paid_date || isOverdue(p)) return false
    return getDaysUntil(p.due_date) <= 30
  }

  const nextPayment = [...unpaid]
    .filter(p => p.due_date)
    .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))[0]

  const alertPayment = unpaid.find(p => p.due_date && (isOverdue(p) || isDueSoon(p)))
  const alertVendorName = alertPayment ? vendors.find(v => v.id === alertPayment.vendor_id)?.name ?? null : null

  const payerGroups = payments.reduce((acc, p) => {
    const payer = p.paid_by || 'couple'
    if (!acc[payer]) acc[payer] = []
    acc[payer].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  const formatDue = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Finances</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Payment tracking across all booked vendors</div>
        </div>

        {/* Consolidated summary tile */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Total Budget</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, fontFamily: 'var(--font-body)' }}>
                {totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : '—'}
              </div>
            </div>
            {nextPayment && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Next due</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)' }}>
                  ${nextPayment.amount.toLocaleString()}{' '}
                  <span style={{ fontSize: '10px', fontWeight: 500 }}>{formatDue(nextPayment.due_date!)}</span>
                </div>
              </div>
            )}
          </div>

          {totalBudget > 0 && (
            <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginBottom: '8px', gap: '2px' }}>
              <div style={{ width: `${Math.max(paidPct, paidPct > 0 ? 1 : 0)}%`, background: 'var(--color-status-booked)', borderRadius: '4px 0 0 4px' }} />
              <div style={{ width: `${Math.max(scheduledPct, scheduledPct > 0 ? 1 : 0)}%`, background: 'var(--color-accent)' }} />
              <div style={{ flex: 1, background: '#EDE8E1', borderRadius: '0 4px 4px 0' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { color: 'var(--color-status-booked)', amount: totalPaid, label: 'Paid' },
              { color: 'var(--color-accent)', amount: totalScheduled, label: 'Scheduled' },
              { color: 'var(--color-border)', amount: totalRemaining, label: 'Remaining' },
            ].map(({ color, amount, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>${amount.toLocaleString()}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 12-month payment calendar */}
        {(() => {
          const weddingDate = couple?.wedding_date ? new Date(couple.wedding_date + 'T00:00:00') : null
          const now = new Date()
          const months: Array<{ year: number; month: number; key: string; label: string; isWedding: boolean }> = []
          for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
            const y = d.getFullYear()
            const m = d.getMonth()
            const isWedding = weddingDate ? (y === weddingDate.getFullYear() && m === weddingDate.getMonth()) : false
            months.push({
              year: y,
              month: m + 1,
              key: `${y}-${String(m + 1).padStart(2, '0')}`,
              label: d.toLocaleDateString('en-US', { month: 'short' }),
              isWedding,
            })
          }
          const paymentsByMonth: Record<string, Payment[]> = {}
          payments.forEach(p => {
            if (p.due_date) {
              const k = p.due_date.substring(0, 7)
              if (!paymentsByMonth[k]) paymentsByMonth[k] = []
              paymentsByMonth[k].push(p)
            }
          })
          const hasAnyPayments = payments.some(p => p.due_date)
          return (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment Calendar</div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {months.map(({ key, label, isWedding }) => {
                    const monthPayments = paymentsByMonth[key] || []
                    const total = monthPayments.reduce((s, p) => s + p.amount, 0)
                    const hasPaid = monthPayments.some(p => p.paid_date)
                    const hasOv = monthPayments.some(p => isOverdue(p))
                    return (
                      <div key={key} style={{
                        padding: '7px 5px',
                        borderRadius: '6px',
                        background: isWedding ? 'rgba(184,146,106,0.08)' : monthPayments.length > 0 ? '#FAFAF8' : 'transparent',
                        border: isWedding ? '1px solid rgba(184,146,106,0.25)' : monthPayments.length > 0 ? '1px solid var(--color-border)' : '1px solid transparent',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: isWedding ? 700 : 500, color: isWedding ? 'var(--color-accent)' : 'var(--color-text-muted)', marginBottom: '3px' }}>
                          {label}
                        </div>
                        {isWedding && <div style={{ fontSize: '8px', color: 'var(--color-accent)', marginBottom: '3px', fontWeight: 700 }}>Wedding</div>}
                        {monthPayments.length > 0 ? (
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: hasOv ? '#C4785C' : hasPaid ? '#7B8F6B' : 'var(--color-text-primary)' }}>
                              {total >= 1000 ? `$${(total / 1000).toFixed(0)}K` : `$${total}`}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>{monthPayments.length}x</div>
                          </div>
                        ) : (
                          <div style={{ height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '14px', height: '1px', background: isWedding ? 'rgba(184,146,106,0.3)' : '#E8E4DF' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!hasAnyPayments && (
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8F5F1', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>What to expect</div>
                    {[
                      { label: 'Deposits', timing: '9–12 months out' },
                      { label: 'Mid-payments', timing: '3–6 months out' },
                      { label: 'Final payments', timing: '2–4 weeks before' },
                    ].map(({ label, timing }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          <strong>{label}</strong> — {timing}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Alert banner — overdue or due within 30 days */}
        {alertPayment && (
          <div style={{ border: '1px solid rgba(196,120,92,0.30)', borderRadius: '8px', padding: '12px 14px', background: 'rgba(196,120,92,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#C4785C', marginBottom: '2px' }}>
                {isOverdue(alertPayment)
                  ? 'Payment overdue!'
                  : `Payment due in ${getDaysUntil(alertPayment.due_date!)} days`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>${alertPayment.amount.toLocaleString()}</strong> · {alertPayment.label}
                {alertVendorName ? ` — ${alertVendorName}` : ''}
              </div>
              {alertPayment.due_date && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Due {new Date(alertPayment.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* By Family */}
        {Object.keys(payerGroups).length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>By Family</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(payerGroups).map(([payer, items]) => {
                const groupTotal = items.reduce((sum, p) => sum + p.amount, 0)
                const label = paidByLabel(payer)
                return (
                  <div key={payer} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px', background: '#fff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', marginBottom: '8px' }}>
                      ${groupTotal.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {items.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < items.length - 1 ? '5px' : 0, borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{p.label}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: p.paid_date ? 'var(--color-status-booked)' : 'var(--color-text-primary)' }}>
                            ${p.amount.toLocaleString()}{p.paid_date ? ' ✓' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment Schedule</div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
            {unpaid.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No upcoming payments.
              </div>
            ) : (
              [...unpaid]
                .sort((a, b) => {
                  if (!a.due_date) return 1
                  if (!b.due_date) return -1
                  return a.due_date > b.due_date ? 1 : -1
                })
                .map((p, i, arr) => {
                  const overdue = isOverdue(p)
                  const dueSoon = isDueSoon(p)
                  const vendor = vendors.find(v => v.id === p.vendor_id)
                  const daysUntilDue = p.due_date ? getDaysUntil(p.due_date) : null
                  const rowBg = overdue ? '#FDF5F1' : dueSoon ? '#FBF5ED' : '#fff'
                  const borderCol = overdue ? '#F5EBE6' : dueSoon ? '#F0E8DB' : 'var(--color-border)'
                  const amtColor = overdue ? '#C4785C' : dueSoon ? '#C4785C' : 'var(--color-text-primary)'

                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${borderCol}` : 'none', background: rowBg }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</span>
                          {overdue && <span style={{ fontSize: '10px', color: '#C4785C', fontWeight: 600, background: '#FAE8E2', padding: '1px 6px', borderRadius: '5px' }}>Overdue</span>}
                          {dueSoon && daysUntilDue !== null && (
                            <span style={{ fontSize: '10px', color: '#9B7040', fontWeight: 600, background: '#F5EDDF', padding: '1px 6px', borderRadius: '5px' }}>
                              {daysUntilDue}d
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                          {vendor?.name ?? paidByLabel(p.paid_by)}{p.due_date ? ` · Due ${formatDue(p.due_date)}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: amtColor }}>${p.amount.toLocaleString()}</span>
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          style={{ fontSize: '10px', border: `1px solid ${overdue ? '#C4785C' : 'var(--color-border)'}`, borderRadius: '6px', padding: '3px 8px', color: overdue ? '#C4785C' : 'var(--color-text-muted)', background: 'none', cursor: 'pointer', fontWeight: overdue ? 600 : 400 }}
                        >
                          Pay
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Remove this payment?')) {
                              try { await deletePayment(p.id); await load() }
                              catch { alert('Failed to remove payment.') }
                            }
                          }}
                          style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                        >✕</button>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {/* Add payment */}
        {showAddForm ? (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Add Payment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Label</label>
                <input placeholder="Deposit" value={newPayment.label} onChange={e => setNewPayment(f => ({ ...f, label: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Amount ($)</label>
                <input type="number" value={newPayment.amount} onChange={e => setNewPayment(f => ({ ...f, amount: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Due Date</label>
                <input type="date" value={newPayment.due_date} onChange={e => setNewPayment(f => ({ ...f, due_date: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Paid By</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['couple', 'family_a', 'family_b'] as const).map(key => {
                    const active = newPayment.paid_by === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewPayment(f => ({ ...f, paid_by: key }))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                          color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          background: active ? 'var(--color-sidebar-active)' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {paidByLabel(key)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Vendor (optional)</label>
                <select value={newPayment.vendor_id} onChange={e => setNewPayment(f => ({ ...f, vendor_id: e.target.value }))} style={{ width: '100%', display: 'block' }}>
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
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              onClick={() => setShowAddForm(true)}
              style={{ display: 'inline-block', border: '1.5px solid var(--color-accent)', borderRadius: '8px', padding: '9px 22px', color: 'var(--color-accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Payment
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
