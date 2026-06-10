import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple, insertPayment, markPaymentPaid, undoPayment, deletePayment, updatePayment } from '../lib/payments'
import type { Couple, Vendor, Payment } from '../types/database'
import { track } from '../lib/analytics'

const PAYMENT_METHODS = ['Credit Card', 'Check', 'Bank Transfer', 'Venmo/Zelle', 'Cash', 'Other'] as const

export default function Finances() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPayment, setNewPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple', vendor_id: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)

  // Pay flow state
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ date: '', method: 'Credit Card', note: '' })
  const [payingSaving, setPayingSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ label: '', amount: '', due_date: '', paid_by: '', vendor_id: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Undo confirmation
  const [undoingId, setUndoingId] = useState<string | null>(null)

  // History expansion
  const [showAllHistory, setShowAllHistory] = useState(false)

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
        status: 'upcoming',
        payment_method: null,
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

  async function handleConfirmPay(paymentId: string) {
    setPayingSaving(true)
    try {
      const p = payments.find(p => p.id === paymentId)
      await markPaymentPaid(paymentId, payForm.date, payForm.method || null, payForm.note || null)
      if (p) track('payment_marked_paid', { amount: p.amount })
      setPayingId(null)
      await load()
    } catch {
      alert('Failed to mark payment as paid. Please try again.')
    } finally {
      setPayingSaving(false)
    }
  }

  async function handleSaveEdit(paymentId: string) {
    setEditSaving(true)
    try {
      await updatePayment(paymentId, {
        label: editForm.label,
        amount: Number(editForm.amount),
        due_date: editForm.due_date || null,
        paid_by: editForm.paid_by,
        vendor_id: editForm.vendor_id || null,
      })
      setEditingId(null)
      await load()
    } catch {
      alert('Failed to save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(paymentId: string) {
    try {
      await deletePayment(paymentId)
      setDeletingId(null)
      await load()
    } catch {
      alert('Failed to remove payment.')
    }
  }

  async function handleUndo(paymentId: string) {
    try {
      await undoPayment(paymentId)
      setUndoingId(null)
      await load()
    } catch {
      alert('Failed to undo payment.')
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const totalBudget = couple?.budget_total ?? 0
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const unpaid = payments.filter(p => p.status === 'upcoming')
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

  const isOverdue = (p: Payment) => !!p.due_date && p.due_date < today && p.status === 'upcoming'
  const isDueSoon = (p: Payment) => {
    if (!p.due_date || p.status === 'paid' || isOverdue(p)) return false
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

  const formatDateLong = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ─── Calendar data ─────────────────────────────────────────────────────────
  const weddingDate = couple?.wedding_date ? new Date(couple.wedding_date + 'T00:00:00') : null
  const months: Array<{ year: number; month: number; key: string; label: string; isWedding: boolean; isCurrent: boolean }> = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const isWedding = weddingDate ? (y === weddingDate.getFullYear() && m === weddingDate.getMonth()) : false
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    months.push({
      year: y, month: m + 1, key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      isWedding, isCurrent: key === currentMonthKey,
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

  // ─── Summary stat bar data ─────────────────────────────────────────────────
  const thisMonthPayments = paymentsByMonth[currentMonthKey] ?? []
  const thisMonthUnpaid = thisMonthPayments.filter(p => p.status === 'upcoming')
  const dueThisMonth = thisMonthUnpaid.reduce((s, p) => s + p.amount, 0)
  const thisMonthHasOverdue = thisMonthPayments.some(p => isOverdue(p))
  const thisMonthAllPaid = thisMonthPayments.length > 0 && thisMonthUnpaid.length === 0

  // Next 3 months (excluding current)
  const next3MonthKeys: string[] = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    next3MonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const dueNext3 = next3MonthKeys.reduce((sum, k) => {
    const mp = paymentsByMonth[k] ?? []
    return sum + mp.filter(p => p.status === 'upcoming').reduce((s, p) => s + p.amount, 0)
  }, 0)

  const totalRemainingAll = unpaid.reduce((sum, p) => sum + p.amount, 0)

  // ─── Filtered payments for schedule ────────────────────────────────────────
  const selectedMonthLabel = selectedMonth
    ? new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  // When filtering by month, show both paid and upcoming for that month
  const filteredPayments = selectedMonth
    ? payments.filter(p => p.due_date?.substring(0, 7) === selectedMonth)
    : unpaid

  // Schedule: upcoming only (overdue first, then by date)
  const schedulePayments = selectedMonth
    ? filteredPayments.filter(p => p.status === 'upcoming')
    : unpaid

  const scheduleSorted = [...schedulePayments].sort((a, b) => {
    const aOverdue = isOverdue(a) ? 0 : 1
    const bOverdue = isOverdue(b) ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date > b.due_date ? 1 : -1
  })

  // History: paid payments, most recent first
  const paidPayments = selectedMonth
    ? filteredPayments.filter(p => p.status === 'paid')
    : payments.filter(p => p.status === 'paid')

  const historySorted = [...paidPayments].sort((a, b) => {
    if (!a.paid_date) return 1
    if (!b.paid_date) return -1
    return b.paid_date > a.paid_date ? 1 : -1
  })

  const historyToShow = showAllHistory ? historySorted : historySorted.slice(0, 10)

  const noDatePayments = selectedMonth ? payments.filter(p => !p.due_date) : []

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  // ─── Render helpers ────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }
  const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', background: '#fff' }

  function renderPayRow(p: Payment, i: number, arr: Payment[]) {
    const overdue = isOverdue(p)
    const dueSoon = isDueSoon(p)
    const vendor = vendors.find(v => v.id === p.vendor_id)
    const daysUntilDue = p.due_date ? getDaysUntil(p.due_date) : null
    const isEditing = editingId === p.id
    const isPaying = payingId === p.id
    const isDeleting = deletingId === p.id

    return (
      <div key={p.id}>
        {/* Main row */}
        {isEditing ? (
          /* ── Edit mode ── */
          <div style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none', background: '#FDFBF8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Label</label>
                <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Amount ($)</label>
                <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vendor</label>
                <select value={editForm.vendor_id} onChange={e => setEditForm(f => ({ ...f, vendor_id: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {vendors.filter(v => v.name).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handleSaveEdit(p.id)}
                disabled={editSaving || !editForm.label || !editForm.amount}
                style={{ fontSize: '12px', fontWeight: 600, padding: '5px 14px', borderRadius: '7px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingId(null)} style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Normal row ── */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
            background: overdue ? '#FDF5F1' : dueSoon ? '#FBF5ED' : '#fff',
            borderLeft: overdue ? '3px solid #C4785C' : 'none',
          }}>
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
                {vendor?.name ?? paidByLabel(p.paid_by)}
                {p.due_date ? (
                  overdue
                    ? <span style={{ color: '#C4785C' }}> · Due {formatDue(p.due_date)} — overdue</span>
                    : ` · Due ${formatDue(p.due_date)}`
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}> · No due date set</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span className="currency currency-sm" style={{ color: overdue ? '#C4785C' : 'var(--color-text-primary)' }}>
                ${p.amount.toLocaleString()}
              </span>
              <button
                onClick={() => {
                  setPayingId(p.id)
                  setPayForm({ date: today, method: 'Credit Card', note: '' })
                }}
                style={{ fontSize: '10px', border: `1px solid ${overdue ? '#C4785C' : 'var(--color-border)'}`, borderRadius: '6px', padding: '3px 8px', color: overdue ? '#C4785C' : 'var(--color-text-muted)', background: 'none', cursor: 'pointer', fontWeight: overdue ? 600 : 400, fontFamily: 'var(--font-body)' }}
              >
                Pay
              </button>
              <button
                onClick={() => {
                  setEditingId(p.id)
                  setEditForm({
                    label: p.label,
                    amount: String(p.amount),
                    due_date: p.due_date || '',
                    paid_by: p.paid_by,
                    vendor_id: p.vendor_id || '',
                  })
                }}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                title="Edit"
              >✎</button>
              <button
                onClick={() => setDeletingId(p.id)}
                style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                title="Delete"
              >✕</button>
            </div>
          </div>
        )}

        {/* ── Pay flow inline card ── */}
        {isPaying && !isEditing && (
          <div style={{
            padding: '12px 14px', background: '#FDFBF8',
            borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
            borderTop: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Mark as paid</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={labelStyle}>Date Paid</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Method</label>
                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={inputStyle}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Note (optional)</label>
              <input value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g., confirmation #1234" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handleConfirmPay(p.id)}
                disabled={payingSaving || !payForm.date}
                style={{ fontSize: '12px', fontWeight: 600, padding: '6px 16px', borderRadius: '7px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: payingSaving ? 0.6 : 1 }}
              >
                {payingSaving ? 'Saving...' : 'Confirm Payment'}
              </button>
              <button onClick={() => setPayingId(null)} style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Delete confirmation ── */}
        {isDeleting && !isEditing && (
          <div style={{
            padding: '10px 14px', background: 'rgba(196,120,92,0.04)',
            borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
            borderTop: '1px solid rgba(196,120,92,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '12px', color: '#C4785C' }}>Delete this payment? This can't be undone.</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDelete(p.id)}
                style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: '#C4785C', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Confirm
              </button>
              <button onClick={() => setDeletingId(null)} style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Payment Tracker</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Payment tracking across all booked vendors</div>
        </div>

        {/* Consolidated summary tile */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Total Budget</div>
              <div className="currency currency-lg" style={{ color: 'var(--color-text-primary)', lineHeight: 1 }}>
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
                  <div className="currency currency-xs" style={{ color: 'var(--color-text-primary)' }}>${amount.toLocaleString()}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment summary stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {/* Due This Month */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 10px', background: '#fff', textAlign: 'center' }}>
            <div className="currency currency-lg" style={{
              lineHeight: 1.2,
              color: thisMonthAllPaid ? '#7B8F6B' : thisMonthHasOverdue ? '#C4785C' : dueThisMonth > 0 ? 'var(--color-accent)' : 'var(--color-text-primary)',
            }}>
              ${dueThisMonth.toLocaleString()}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {thisMonthAllPaid ? 'All clear' : 'Due This Month'}
            </div>
          </div>

          {/* Due Next 3 Months */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 10px', background: '#fff', textAlign: 'center' }}>
            <div className="currency currency-lg" style={{ lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
              ${dueNext3.toLocaleString()}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Next 3 Months
            </div>
          </div>

          {/* Total Remaining */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 10px', background: '#fff', textAlign: 'center' }}>
            <div className="currency currency-lg" style={{ lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
              ${totalRemainingAll.toLocaleString()}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Remaining
            </div>
          </div>

          {/* Total Paid */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 10px', background: '#fff', textAlign: 'center' }}>
            <div className="currency currency-lg" style={{ lineHeight: 1.2, color: '#7B8F6B' }}>
              ${totalPaid.toLocaleString()}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Paid
            </div>
          </div>
        </div>

        {/* 12-month payment calendar */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment Calendar</div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
            <div className="table-scroll-container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', minWidth: '360px' }}>
              {months.map(({ key, label, isWedding, isCurrent }) => {
                const monthPayments = paymentsByMonth[key] || []
                const total = monthPayments.reduce((s, p) => s + p.amount, 0)
                const paidCount = monthPayments.filter(p => p.status === 'paid').length
                const overdueCount = monthPayments.filter(p => isOverdue(p)).length
                const pendingCount = monthPayments.filter(p => p.status === 'upcoming' && !isOverdue(p)).length
                const isSelected = selectedMonth === key
                const isHovered = hoveredMonth === key
                const hasPayments = monthPayments.length > 0

                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (hasPayments) setSelectedMonth(isSelected ? null : key)
                    }}
                    onMouseEnter={() => setHoveredMonth(key)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    style={{
                      padding: '7px 5px',
                      borderRadius: '6px',
                      background: isSelected ? 'rgba(184,146,106,0.12)' :
                        isHovered && hasPayments ? 'rgba(184,146,106,0.06)' :
                        isWedding ? 'rgba(184,146,106,0.08)' :
                        hasPayments ? '#FAFAF8' : 'transparent',
                      border: isSelected ? '1.5px solid var(--color-accent)' :
                        isHovered && hasPayments ? '1px solid rgba(184,146,106,0.15)' :
                        isWedding ? '1px solid rgba(184,146,106,0.25)' :
                        hasPayments ? '1px solid var(--color-border)' : '1px solid transparent',
                      textAlign: 'center',
                      cursor: hasPayments ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Quick-add on hover (desktop only) */}
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const firstOfMonth = `${key}-01`
                          setNewPayment(f => ({ ...f, due_date: firstOfMonth }))
                          setShowAddForm(true)
                        }}
                        style={{
                          position: 'absolute', top: '2px', right: '3px',
                          fontSize: '10px', color: 'var(--color-text-muted)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                        }}
                      >+</button>
                    )}

                    <div style={{ fontSize: '10px', fontWeight: isWedding || isCurrent ? 700 : 500, color: isWedding ? 'var(--color-accent)' : 'var(--color-text-muted)', marginBottom: '1px' }}>
                      {label}
                    </div>
                    {/* Current month gold dot */}
                    {isCurrent && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-accent)', margin: '0 auto 2px' }} />
                    )}
                    {isWedding && <div style={{ fontSize: '8px', color: 'var(--color-accent)', marginBottom: '3px', fontWeight: 700 }}>Wedding</div>}
                    {hasPayments ? (
                      <div>
                        <div className="currency currency-xs" style={{
                          color: overdueCount > 0 ? '#C4785C' : paidCount === monthPayments.length ? '#7B8F6B' : 'var(--color-text-primary)',
                          opacity: paidCount === monthPayments.length ? 0.6 : 1,
                        }}>
                          {total >= 1000 ? `$${(total / 1000).toFixed(0)}K` : `$${total}`}
                        </div>
                        {/* Status dots */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                          {paidCount > 0 && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#7B8F6B' }} />}
                          {pendingCount > 0 && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-accent)' }} />}
                          {overdueCount > 0 && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C4785C' }} />}
                        </div>
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
            </div>{/* end table-scroll-container */}
            {!hasAnyPayments && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8F5F1', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>What to expect</div>
                {[
                  { label: 'Deposits', timing: '9\u201312 months out' },
                  { label: 'Mid-payments', timing: '3\u20136 months out' },
                  { label: 'Final payments', timing: '2\u20134 weeks before' },
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

        {/* Filter bar */}
        {selectedMonth && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(184,146,106,0.06)', border: '1px solid rgba(184,146,106,0.15)',
            borderRadius: '8px', padding: '8px 14px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
              Showing <strong style={{ color: 'var(--color-accent)' }}>{filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}</strong> in <strong style={{ color: 'var(--color-accent)' }}>{selectedMonthLabel}</strong>
            </div>
            <button
              onClick={() => setSelectedMonth(null)}
              style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
            >
              × Clear
            </button>
          </div>
        )}

        {/* Alert banner — overdue or due within 30 days */}
        {!selectedMonth && alertPayment && (
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
        {!selectedMonth && Object.keys(payerGroups).length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>By Family</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
              {Object.entries(payerGroups).map(([payer, items]) => {
                const groupTotal = items.reduce((sum, p) => sum + p.amount, 0)
                const label = paidByLabel(payer)
                return (
                  <div key={payer} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px', background: '#fff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                    <div className="currency currency-md" style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                      ${groupTotal.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {items.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < items.length - 1 ? '5px' : 0, borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{p.label}</span>
                          <span className="currency currency-xs" style={{ color: p.status === 'paid' ? 'var(--color-status-booked)' : 'var(--color-text-primary)' }}>
                            ${p.amount.toLocaleString()}{p.status === 'paid' ? ' ✓' : ''}
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

        {/* ═══════ Payment Schedule ═══════ */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment Schedule</div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
            {scheduleSorted.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                {selectedMonth ? `No upcoming payments in ${selectedMonthLabel}.` : 'No upcoming payments. You\'re all caught up!'}
              </div>
            ) : (
              scheduleSorted.map((p, i, arr) => renderPayRow(p, i, arr))
            )}
          </div>
          {/* No-date payment note when filtering */}
          {selectedMonth && noDatePayments.length > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', textAlign: 'center' }}>
              {noDatePayments.length} payment{noDatePayments.length !== 1 ? 's have' : ' has'} no due date
            </div>
          )}
        </div>

        {/* Add payment */}
        {showAddForm ? (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', background: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Add Payment</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]" style={{ marginBottom: '12px' }}>
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

        {/* ═══════ Payment History ═══════ */}
        {historySorted.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment History</div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              {historyToShow.map((p, i, arr) => {
                const vendor = vendors.find(v => v.id === p.vendor_id)
                const isUndoing = undoingId === p.id
                const isHistoryDeleting = deletingId === p.id

                return (
                  <div key={p.id}>
                    <div
                      className="history-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                        borderLeft: '3px solid #7B8F6B',
                        background: 'rgba(123,143,107,0.03)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{p.label}</div>
                        {vendor && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{vendor.name}</div>}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                          Paid {p.paid_date ? formatDateLong(p.paid_date) : ''}
                          {p.payment_method ? ` via ${p.payment_method}` : ''}
                        </div>
                        {p.notes && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '1px' }}>{p.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span className="currency currency-xs" style={{ color: '#7B8F6B' }}>
                          ${p.amount.toLocaleString()}
                        </span>
                        <button
                          onClick={() => setUndoingId(p.id)}
                          className="undo-btn"
                          style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: '2px 4px' }}
                        >
                          Undo
                        </button>
                        <button
                          onClick={() => setDeletingId(p.id)}
                          style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                          title="Delete"
                        >✕</button>
                      </div>
                    </div>

                    {/* Undo confirmation */}
                    {isUndoing && (
                      <div style={{
                        padding: '8px 14px', background: 'rgba(184,146,106,0.04)',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                        borderTop: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Move this payment back to your schedule?</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUndo(p.id)}
                            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                          >
                            Yes, undo
                          </button>
                          <button onClick={() => setUndoingId(null)} style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delete confirmation for history */}
                    {isHistoryDeleting && !isUndoing && (
                      <div style={{
                        padding: '8px 14px', background: 'rgba(196,120,92,0.04)',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                        borderTop: '1px solid rgba(196,120,92,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: '12px', color: '#C4785C' }}>Permanently delete this payment record?</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleDelete(p.id)}
                            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: '#C4785C', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                          >
                            Confirm
                          </button>
                          <button onClick={() => setDeletingId(null)} style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {historySorted.length > 10 && !showAllHistory && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <button
                  onClick={() => setShowAllHistory(true)}
                  style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                >
                  Show all {historySorted.length} payments
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  )
}
