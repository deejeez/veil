# Vendors + Finances UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Vendors grid, Finances page, and VendorDetail payment section to have clear visual hierarchy, consolidated information, and inline payment scheduling on booked vendors.

**Architecture:** Pure UI/layout changes to three existing pages plus a small lib extension. No schema changes — the `payments` table already has a nullable `vendor_id` field. Each task is independently shippable.

**Tech Stack:** React 18, TypeScript, Vite, inline styles (project convention), Supabase JS client, React Router v6.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/payments.ts` | Add `getPaymentsForVendor` + `updatePayment` |
| `src/pages/Vendors.tsx` | Full replacement — summary bar + 3-col 3-state grid |
| `src/pages/Finances.tsx` | Full replacement — consolidated tile, no tabs, inline layout |
| `src/pages/VendorDetail.tsx` | Add Payment Schedule section on booked vendors; polish AI shortlist |

---

## Task 1: Extend payments lib

**Files:**
- Modify: `src/lib/payments.ts`

No test framework exists in this project. Verify by running `bun run dev` and checking the browser network tab.

- [ ] **Step 1: Add `getPaymentsForVendor` and `updatePayment` to the lib**

Open `src/lib/payments.ts`. The current file ends after `getUpcomingPayments`. Append these two functions:

```typescript
export async function getPaymentsForVendor(vendorId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return data as Payment[]
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<Pick<Payment, 'label' | 'amount' | 'due_date' | 'paid_by'>>
): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
  if (error) throw error
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mgiancristofaro/wedding-planner && npx tsc --noEmit
```

Expected: no errors referencing `payments.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/payments.ts
git commit -m "feat: add getPaymentsForVendor and updatePayment to payments lib"
```

---

## Task 2: Redesign Vendors page

**Files:**
- Modify: `src/pages/Vendors.tsx`

The current page uses `repeat(auto-fill, minmax(280px, 1fr))` with large Card components. Replace with a 3-col compact grid + summary bar.

- [ ] **Step 1: Replace `src/pages/Vendors.tsx` with the full redesign**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { type Vendor, VENDOR_CATEGORY_LABELS, VENDOR_CATEGORIES } from '../types/database'

const IN_PROGRESS_STATUSES = ['researching', 'shortlisted', 'meeting_scheduled']

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const couple = await getCoupleForUser(user.id)
        if (!couple) return
        await seedDefaultVendorCategories(couple.id)
        setVendors(await getVendorsForCouple(couple.id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const vendorsByCategory = VENDOR_CATEGORIES.map(cat => {
    const catVendors = vendors.filter(v => v.category === cat && v.status !== 'eliminated')
    const booked = catVendors.find(v => v.status === 'booked')
    const active = catVendors.filter(v => IN_PROGRESS_STATUSES.includes(v.status))
    const shortlistedCount = catVendors.filter(v => v.status === 'shortlisted').length

    let state: 'booked' | 'in_progress' | 'not_started'
    if (booked) state = 'booked'
    else if (active.length > 0) state = 'in_progress'
    else state = 'not_started'

    let subLabel = ''
    if (state === 'booked' && booked?.name) subLabel = booked.name
    else if (state === 'in_progress') {
      if (shortlistedCount > 0) subLabel = `${shortlistedCount} shortlisted`
      else if (active.some(v => v.status === 'meeting_scheduled')) subLabel = 'Meeting scheduled'
      else subLabel = 'Researching'
    }

    return { category: cat, state, subLabel, activeCount: active.length }
  })

  const bookedCount = vendorsByCategory.filter(v => v.state === 'booked').length
  const activeCount = vendorsByCategory.filter(v => v.state === 'in_progress').length
  const notStartedCount = vendorsByCategory.filter(v => v.state === 'not_started').length
  const total = VENDOR_CATEGORIES.length

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Vendors</div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>Track and manage all your wedding vendors</div>
      </div>

      {/* Summary bar */}
      <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', background: '#fff', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', minWidth: '36px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            {bookedCount}<span style={{ fontSize: '11px', color: '#ccc' }}>/{total}</span>
          </div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Booked</div>
        </div>
        <div style={{ flex: 1, height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${(bookedCount / total) * 100}%`, height: '100%', background: '#4caf50', borderRadius: '3px' }} />
        </div>
        <div style={{ textAlign: 'center', minWidth: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#c4788a', lineHeight: 1 }}>{activeCount}</div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Active</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ccc', lineHeight: 1 }}>{notStartedCount}</div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>To do</div>
        </div>
      </div>

      {/* 3-column vendor grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
        {vendorsByCategory.map(({ category, state, subLabel, activeCount: cnt }) => {
          const tileStyle =
            state === 'booked'
              ? { border: '1.5px solid #a5d6a7', background: '#f0faf0' }
              : state === 'in_progress'
              ? { border: '1px solid #e8c4ce', background: '#fdf5f7' }
              : { border: '1px solid #e0e0e0', background: '#f5f5f5' }

          return (
            <div
              key={category}
              style={{ ...tileStyle, borderRadius: '8px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}
              onClick={() => navigate(`/vendors/${category}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: state === 'booked' ? 700 : 600, color: state === 'booked' ? '#1b5e20' : 'var(--color-text-primary)', fontSize: '12px' }}>
                  {VENDOR_CATEGORY_LABELS[category]}
                </div>
                {state === 'booked' && (
                  <span style={{ fontSize: '9px', background: '#c8e6c9', color: '#2e7d32', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>
                    BOOKED
                  </span>
                )}
                {state === 'in_progress' && cnt > 0 && (
                  <span style={{ fontSize: '9px', background: '#fce4ec', color: '#c4788a', padding: '1px 5px', borderRadius: '6px', fontWeight: 600, flexShrink: 0 }}>
                    {cnt}
                  </span>
                )}
              </div>
              {subLabel && (
                <div style={{ fontSize: '11px', color: state === 'booked' ? '#388e3c' : state === 'in_progress' ? '#c4788a' : '#888', fontWeight: 500 }}>
                  {subLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Verify in dev server**

```bash
bun run dev
```

Open http://localhost:5173/vendors. Confirm:
- Summary bar shows correct booked/active/todo counts
- 3-column grid renders
- Booked tiles are green, in-progress are rose, not-started are grey with dark text
- Clicking a tile navigates to `/vendors/:category`

- [ ] **Step 3: Commit**

```bash
git add src/pages/Vendors.tsx
git commit -m "feat: redesign vendors page — 3-col grid with summary bar and 3-state colors"
```

---

## Task 3: Redesign Finances page

**Files:**
- Modify: `src/pages/Finances.tsx`

Remove tabs. Consolidate 4 stat cards into one summary tile with a 3-part progress bar. Move By Family above payment schedule.

- [ ] **Step 1: Replace `src/pages/Finances.tsx` with the full redesign**

```tsx
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
  const paidPct = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0
  const scheduledPct = totalBudget > 0 ? (totalScheduled / totalBudget) * 100 : 0

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
      <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Finances</div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Payment tracking across all booked vendors</div>
        </div>

        {/* Consolidated summary tile */}
        <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '14px 16px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Total Budget</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, fontFamily: 'var(--font-heading)' }}>
                {totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : '—'}
              </div>
            </div>
            {nextPayment && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>Next due</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#c4788a' }}>
                  ${nextPayment.amount.toLocaleString()}{' '}
                  <span style={{ fontSize: '10px', fontWeight: 500 }}>{formatDue(nextPayment.due_date!)}</span>
                </div>
              </div>
            )}
          </div>

          {totalBudget > 0 && (
            <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginBottom: '8px', gap: '2px' }}>
              <div style={{ width: `${Math.max(paidPct, paidPct > 0 ? 1 : 0)}%`, background: '#4caf50', borderRadius: '4px 0 0 4px' }} />
              <div style={{ width: `${Math.max(scheduledPct, scheduledPct > 0 ? 1 : 0)}%`, background: '#c4788a' }} />
              <div style={{ flex: 1, background: '#f0ede8', borderRadius: '0 4px 4px 0' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { color: '#4caf50', amount: totalPaid, label: 'Paid' },
              { color: '#c4788a', amount: totalScheduled, label: 'Scheduled' },
              { color: '#e8e3dc', amount: totalRemaining, label: 'Remaining' },
            ].map(({ color, amount, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>${amount.toLocaleString()}</div>
                  <div style={{ fontSize: '10px', color: '#aaa' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert banner — overdue or due within 30 days */}
        {alertPayment && (
          <div style={{ border: '1px solid #fcd5d5', borderRadius: '10px', padding: '12px 14px', background: '#fff5f5', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', marginBottom: '2px' }}>
                {isOverdue(alertPayment)
                  ? 'Payment overdue!'
                  : `Payment due in ${getDaysUntil(alertPayment.due_date!)} days`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>${alertPayment.amount.toLocaleString()}</strong> · {alertPayment.label}
                {vendors.find(v => v.id === alertPayment.vendor_id)?.name
                  ? ` — ${vendors.find(v => v.id === alertPayment.vendor_id)!.name}`
                  : ''}
              </div>
              {alertPayment.due_date && (
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                  Due {new Date(alertPayment.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* By Family */}
        {Object.keys(payerGroups).length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>By Family</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(payerGroups).map(([payer, items]) => {
                const groupTotal = items.reduce((sum, p) => sum + p.amount, 0)
                const label = payer.replace('_', "'s ").replace(/\b\w/g, c => c.toUpperCase())
                return (
                  <div key={payer} style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '12px 14px', background: '#fff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                      ${groupTotal.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {items.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < items.length - 1 ? '5px' : 0, borderBottom: i < items.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                          <span style={{ fontSize: '11px', color: '#666' }}>{p.label}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: p.paid_date ? '#4caf50' : 'var(--color-text-primary)' }}>
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
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Payment Schedule</div>
          <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
            {unpaid.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#aaa', textAlign: 'center' }}>
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
                  const rowBg = overdue ? '#fff5f5' : dueSoon ? '#fffbf4' : '#fff'
                  const borderCol = overdue ? '#fff0f0' : dueSoon ? '#fef6ec' : '#f0ede8'
                  const amtColor = overdue ? '#c0392b' : dueSoon ? '#e67e22' : 'var(--color-text-primary)'

                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${borderCol}` : 'none', background: rowBg }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</span>
                          {overdue && <span style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, background: '#fde8e8', padding: '1px 6px', borderRadius: '5px' }}>Overdue</span>}
                          {dueSoon && daysUntilDue !== null && (
                            <span style={{ fontSize: '10px', color: '#e67e22', fontWeight: 600, background: '#fef0e0', padding: '1px 6px', borderRadius: '5px' }}>
                              {daysUntilDue}d
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>
                          {vendor?.name ?? p.paid_by}{p.due_date ? ` · Due ${formatDue(p.due_date)}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: amtColor }}>${p.amount.toLocaleString()}</span>
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          style={{ fontSize: '10px', border: `1px solid ${overdue ? '#c0392b' : '#e5e0d8'}`, borderRadius: '6px', padding: '3px 8px', color: overdue ? '#c0392b' : '#888', background: 'none', cursor: 'pointer', fontWeight: overdue ? 600 : 400 }}
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
                          style={{ fontSize: '11px', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
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
          <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '14px 16px', background: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Add Payment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Label</label>
                <input placeholder="Deposit" value={newPayment.label} onChange={e => setNewPayment(f => ({ ...f, label: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Amount ($)</label>
                <input type="number" value={newPayment.amount} onChange={e => setNewPayment(f => ({ ...f, amount: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Due Date</label>
                <input type="date" value={newPayment.due_date} onChange={e => setNewPayment(f => ({ ...f, due_date: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Paid By</label>
                <input placeholder="couple" value={newPayment.paid_by} onChange={e => setNewPayment(f => ({ ...f, paid_by: e.target.value }))} style={{ display: 'block' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Vendor (optional)</label>
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
              style={{ display: 'inline-block', border: '1.5px solid #c4788a', borderRadius: '10px', padding: '9px 22px', color: '#c4788a', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Payment
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Verify in dev server**

```bash
bun run dev
```

Open http://localhost:5173/finances. Confirm:
- One summary tile with dollar total, 3-part progress bar, and legend
- Alert banner appears if any payment is overdue or due within 30 days
- By Family cards appear above the payment schedule
- Payment schedule rows are color-coded (red=overdue, amber=soon, white=future)
- "Pay" button marks a payment as paid and updates the progress bar
- "+ Add Payment" opens the inline form

- [ ] **Step 3: Commit**

```bash
git add src/pages/Finances.tsx
git commit -m "feat: redesign finances page — consolidated summary tile, alert banner, by family above schedule"
```

---

## Task 4: VendorDetail — payment scheduling + AI shortlist polish

**Files:**
- Modify: `src/pages/VendorDetail.tsx`

Add a "Payment Schedule" section that appears on booked vendors, inline below Contract Review. Also polish the AI shortlist section from dev-prototype styling to a proper card.

- [ ] **Step 1: Add payment state and loader**

At the top of the `VendorDetail` function, after the existing state declarations (line ~29), add:

```tsx
const [vendorPayments, setVendorPayments] = useState<Record<string, Payment[]>>({})
const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null)
const [newVendorPayment, setNewVendorPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple' })
const [savingVendorPayment, setSavingVendorPayment] = useState(false)
```

- [ ] **Step 2: Add Payment import**

In the import block, `src/lib/payments.ts` is not yet imported in VendorDetail. Add:

```tsx
import { getPaymentsForVendor, insertPayment, markPaymentPaid, deletePayment } from '../lib/payments'
import type { Payment } from '../types/database'
```

Note: `Payment` is already imported from `'../types/database'` in the existing file via the `type` import on line 11 — verify and merge if needed. The existing line is:
```tsx
import type { AiReview, AiReviewFlag } from '../types/database'
```
Update to:
```tsx
import type { AiReview, AiReviewFlag, Payment } from '../types/database'
```

- [ ] **Step 3: Load vendor payments in the `load` function**

The existing `load` function (lines 33–50) fetches vendors and contracts. After `setContracts(...)`, add a payment load for all booked vendors:

```tsx
// At the end of the load function, before the finally block:
const bookedVendors = all.filter(v => v.category === category && v.status === 'booked')
if (bookedVendors.length > 0) {
  const paymentResults = await Promise.all(bookedVendors.map(v => getPaymentsForVendor(v.id)))
  const paymentMap: Record<string, Payment[]> = {}
  bookedVendors.forEach((v, i) => { paymentMap[v.id] = paymentResults[i] })
  setVendorPayments(paymentMap)
}
```

- [ ] **Step 4: Add handler functions for vendor payments**

After `handleContractUpload` (ends around line 184), add:

```tsx
async function handleAddVendorPayment(vendorId: string) {
  if (!couple) return
  setSavingVendorPayment(true)
  try {
    await insertPayment({
      couple_id: couple.id,
      vendor_id: vendorId,
      label: newVendorPayment.label,
      amount: Number(newVendorPayment.amount),
      due_date: newVendorPayment.due_date || null,
      paid_date: null,
      paid_by: newVendorPayment.paid_by,
      notes: null,
    })
    setAddingPaymentFor(null)
    setNewVendorPayment({ label: '', amount: '', due_date: '', paid_by: 'couple' })
    await load()
  } catch {
    alert('Failed to add payment. Please try again.')
  } finally {
    setSavingVendorPayment(false)
  }
}

async function handleMarkVendorPaymentPaid(paymentId: string) {
  try {
    await markPaymentPaid(paymentId, new Date().toISOString().split('T')[0])
    await load()
  } catch {
    alert('Failed to mark payment as paid. Please try again.')
  }
}

async function handleDeleteVendorPayment(paymentId: string) {
  if (!confirm('Remove this payment?')) return
  try {
    await deletePayment(paymentId)
    await load()
  } catch {
    alert('Failed to remove payment. Please try again.')
  }
}
```

- [ ] **Step 5: Replace the booked-vendor section in JSX**

Find the existing `{vendor.status === 'booked' && (` block (around line 264). It currently shows only "Contract Review". Replace it with an expanded version that adds a "Payment Schedule" section:

```tsx
{vendor.status === 'booked' && (
  <div style={{ marginTop: '12px', borderTop: '1px solid #f0ede8', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

    {/* Payment Schedule */}
    <div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
        Payment Schedule
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(vendorPayments[vendor.id] ?? []).map(p => {
          const today = new Date().toISOString().split('T')[0]
          const isOverdue = !!p.due_date && p.due_date < today && !p.paid_date
          const isPaid = !!p.paid_date
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: isPaid ? '#f0faf0' : isOverdue ? '#fff5f5' : '#fafafa', border: `1px solid ${isPaid ? '#a5d6a7' : isOverdue ? '#fcd5d5' : '#e5e0d8'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>
                  ${p.amount.toLocaleString()}
                  {p.due_date ? ` · Due ${new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  {isPaid ? ' · Paid ✓' : ''}
                </div>
              </div>
              {!isPaid && (
                <button
                  onClick={() => handleMarkVendorPaymentPaid(p.id)}
                  style={{ fontSize: '10px', border: `1px solid ${isOverdue ? '#c0392b' : '#e5e0d8'}`, borderRadius: '6px', padding: '3px 8px', color: isOverdue ? '#c0392b' : '#888', background: 'none', cursor: 'pointer' }}
                >
                  Pay
                </button>
              )}
              <button
                onClick={() => handleDeleteVendorPayment(p.id)}
                style={{ fontSize: '11px', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              >✕</button>
            </div>
          )
        })}
      </div>

      {addingPaymentFor === vendor.id ? (
        <div style={{ marginTop: '8px', padding: '10px 12px', border: '1px solid #e5e0d8', borderRadius: '8px', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Label</label>
              <input placeholder="Deposit" value={newVendorPayment.label} onChange={e => setNewVendorPayment(f => ({ ...f, label: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Amount ($)</label>
              <input type="number" value={newVendorPayment.amount} onChange={e => setNewVendorPayment(f => ({ ...f, amount: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Due Date</label>
              <input type="date" value={newVendorPayment.due_date} onChange={e => setNewVendorPayment(f => ({ ...f, due_date: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Paid By</label>
              <input placeholder="couple" value={newVendorPayment.paid_by} onChange={e => setNewVendorPayment(f => ({ ...f, paid_by: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => { setAddingPaymentFor(null); setNewVendorPayment({ label: '', amount: '', due_date: '', paid_by: 'couple' }) }}>
              Cancel
            </Button>
            <Button onClick={() => handleAddVendorPayment(vendor.id)} disabled={savingVendorPayment || !newVendorPayment.label || !newVendorPayment.amount}>
              {savingVendorPayment ? 'Saving...' : 'Add'}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingPaymentFor(vendor.id)}
          style={{ marginTop: '6px', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + Add payment
        </button>
      )}
    </div>

    {/* Contract Review */}
    <div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
        Contract Review
      </p>
      {contracts.filter(c => c.vendor_id === vendor.id).length === 0 ? (
        <label style={{ cursor: uploadingContract ? 'default' : 'pointer' }}>
          <input
            type="file" accept=".pdf" style={{ display: 'none' }}
            disabled={uploadingContract}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleContractUpload(vendor.id, f) }}
          />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-accent)', textDecoration: 'underline', cursor: uploadingContract ? 'default' : 'pointer' }}>
            {uploadingContract ? 'Uploading & reviewing...' : '+ Upload Contract PDF'}
          </span>
        </label>
      ) : null}
      {contracts.filter(c => c.vendor_id === vendor.id).map(c => (
        <div key={c.id}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', margin: '0 0 8px 0' }}>
            📄 {c.file_name}
            {reviewingContractId === c.id && <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px', fontStyle: 'italic' }}>Reviewing contract...</span>}
          </p>
          {c.ai_review?.status === 'complete' && (
            <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text-primary)', marginBottom: '12px', lineHeight: 1.5 }}>
                {c.ai_review.summary}
              </p>
              {c.ai_review.flags.map((flag: AiReviewFlag, i: number) => {
                const key = `${c.id}-${i}`
                const severityColor: Record<string, string> = { flag: '#B91C1C', caution: 'var(--color-status-short)', info: 'var(--color-text-secondary)' }
                return (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <button
                      onClick={() => setExpandedFlag(expandedFlag === key ? null : key)}
                      style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: severityColor[flag.severity], fontWeight: 700 }}>
                        {flag.severity}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)' }}>{flag.clause}</span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{expandedFlag === key ? '▲' : '▼'}</span>
                    </button>
                    {expandedFlag === key && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                        {flag.text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>

  </div>
)}
```

- [ ] **Step 6: Polish the AI shortlist section**

Find the AI shortlist `<div>` near the bottom of the JSX (currently `style={{ marginTop: '24px', padding: '16px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}`).

Replace the outer wrapper style and the shortlist item style:

```tsx
{/* AI Vendor Shortlist */}
<div style={{ marginTop: '24px', border: '1px solid #e5e0d8', borderRadius: '12px', padding: '16px 18px', background: '#fff' }}>
  <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 4px 0', fontWeight: 600 }}>
    AI Vendor Shortlist
  </p>
  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
    Get 4–6 vendors in your city ranked against your vibe profile.
  </p>
  <Button onClick={handleGetShortlist} disabled={shortlistLoading} variant="secondary">
    {shortlistLoading ? 'Finding vendors...' : 'Get AI Shortlist'}
  </Button>
  {shortlistError && (
    <p style={{ color: '#B91C1C', fontSize: '13px', marginTop: '8px' }}>{shortlistError}</p>
  )}
  {shortlist.length > 0 && (
    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {shortlist.map((v, i) => (
        <div key={i} style={{ padding: '10px 12px', border: '1px solid #e5e0d8', borderRadius: '8px', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', margin: '0 0 2px 0', color: 'var(--color-text-primary)' }}>{v.name}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#aaa', margin: '0 0 3px 0' }}>{v.address}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-secondary)', margin: 0 }}>{v.reason}</p>
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!couple) return
              try {
                const vendor = await upsertVendor({
                  couple_id: couple.id,
                  category: category!,
                  name: v.name,
                  website: v.website,
                  status: 'shortlisted',
                })
                setVendors(prev => [...prev, vendor])
              } catch {
                alert('Failed to add vendor. Please try again.')
              }
            }}
          >
            Add →
          </Button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/mgiancristofaro/wedding-planner && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Verify in dev server**

```bash
bun run dev
```

Navigate to a booked vendor category (e.g., `/vendors/venue`). Confirm:
- "Payment Schedule" section appears below the vendor's status/edit area
- "+ Add payment" button opens an inline form with label, amount, due date, paid_by
- Adding a payment saves and appears in the list
- "Pay" button marks a payment as paid (row turns green)
- The same payment now appears on the Finances page at http://localhost:5173/finances
- AI shortlist section has rounded card styling, clean item cards

- [ ] **Step 9: Commit**

```bash
git add src/pages/VendorDetail.tsx
git commit -m "feat: add payment scheduling to booked vendors + polish AI shortlist section"
```

---

## Final check

After all 4 tasks:

- [ ] Run `npx tsc --noEmit` — no TypeScript errors
- [ ] Visit `/vendors` — summary bar + 3-col grid, all 3 states visible
- [ ] Visit `/finances` — consolidated tile with progress bar, By Family above schedule, urgency colors
- [ ] Visit a booked vendor category — payment schedule section present, payments sync to Finances page
- [ ] Visit an in-progress vendor category — no payment schedule section shown (correct)
- [ ] Commit any remaining changes and push

```bash
git push origin main
```
