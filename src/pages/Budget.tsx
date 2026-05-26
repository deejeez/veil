import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getBudgetCategories, upsertBudgetCategory, computeBudgetSummary } from '../lib/budget'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple } from '../lib/payments'
import { type Couple, VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from '../types/database'

type BudgetRow = {
  id: string
  couple_id: string
  category: string
  budgeted: number
  booked: number
  paid: number
  remaining: number
}

export default function Budget() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [allPaidTotal, setAllPaidTotal] = useState(0)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)

      const [categories, vendors, payments] = await Promise.all([
        getBudgetCategories(c.id),
        getVendorsForCouple(c.id),
        getPaymentsForCouple(c.id),
      ])

      // Ensure all 14 categories have budget rows
      const existingCats = new Set(categories.map(bc => bc.category))
      for (const cat of VENDOR_CATEGORIES) {
        if (!existingCats.has(cat)) {
          categories.push({ id: '', couple_id: c.id, category: cat, budgeted: 0 })
        }
      }

      const summary = computeBudgetSummary(categories, vendors, payments)
      setRows(summary as BudgetRow[])
      setAllPaidTotal(payments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSaveBudget(category: string) {
    if (!couple) return
    const value = Number(editValue)
    if (isNaN(value) || value < 0) return
    try {
      await upsertBudgetCategory(couple.id, category, value)
      setEditingCategory(null)
      await load()
    } catch {
      alert('Failed to save budget. Please try again.')
    }
  }

  const totalBudgeted = rows.reduce((sum, r) => sum + r.budgeted, 0)
  const totalBooked = rows.reduce((sum, r) => sum + r.booked, 0)
  const totalPaid = allPaidTotal  // all paid payments, including non-vendor ones
  const commitPercent = totalBudgeted > 0 ? Math.round((totalBooked / totalBudgeted) * 100) : 0

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, marginBottom: '8px' }}>
        Budget
      </h1>

      {commitPercent >= 100 && (
        <div style={{ padding: '12px 16px', background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.2)', borderRadius: '12px', marginBottom: '20px', fontFamily: 'var(--font-body)', fontSize: '14px', color: '#B91C1C' }}>
          Budget exceeded — committed {commitPercent}% of total
        </div>
      )}
      {commitPercent >= 90 && commitPercent < 100 && (
        <div style={{ padding: '12px 16px', background: 'rgba(154,120,64,0.08)', border: '1px solid var(--color-status-short)', borderRadius: '12px', marginBottom: '20px', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-status-short)' }}>
          Approaching budget — {commitPercent}% committed
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Budget', value: `$${(totalBudgeted / 1000).toFixed(0)}K` },
          { label: 'Committed', value: `$${(totalBooked / 1000).toFixed(1)}K` },
          { label: 'Paid', value: `$${(totalPaid / 1000).toFixed(1)}K` },
          { label: 'Remaining', value: `$${((totalBudgeted - totalBooked) / 1000).toFixed(1)}K` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <SectionLabel>{label}</SectionLabel>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', margin: 0 }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
          {['Category', 'Budgeted', 'Booked', 'Paid', 'Remaining'].map(h => (
            <p key={h} style={{ fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: 0 }}>{h}</p>
          ))}
        </div>

        {rows.map(row => {
          const bookedPercent = row.budgeted > 0 ? Math.min(100, Math.round((row.booked / row.budgeted) * 100)) : 0
          const isOver = row.remaining < 0 && row.budgeted > 0
          return (
          <div key={row.category} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '10px 0', borderBottom: '1px solid var(--color-bg)', alignItems: 'center' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
                {VENDOR_CATEGORY_LABELS[row.category as keyof typeof VENDOR_CATEGORY_LABELS] ?? row.category}
              </p>
              {row.budgeted > 0 && (
                <div style={{ height: '3px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden', width: '80%' }}>
                  <div style={{ height: '100%', width: `${bookedPercent}%`, background: isOver ? '#B91C1C' : 'var(--color-accent)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                </div>
              )}
            </div>

            {editingCategory === row.category ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(row.category); if (e.key === 'Escape') setEditingCategory(null) }}
                  autoFocus
                  style={{ width: '90px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: '13px' }}
                />
                <button onClick={() => handleSaveBudget(row.category)} style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
              </div>
            ) : (
              <p
                onClick={() => { setEditingCategory(row.category); setEditValue(String(row.budgeted)) }}
                style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)', margin: 0, cursor: 'pointer', borderBottom: '1px dashed var(--color-border)' }}
                title="Click to edit"
              >
                {row.budgeted > 0 ? `$${row.budgeted.toLocaleString()}` : '—'}
              </p>
            )}

            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-text-primary)', margin: 0 }}>
              {row.booked > 0 ? `$${row.booked.toLocaleString()}` : '—'}
            </p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--color-status-booked)', margin: 0 }}>
              {row.paid > 0 ? `$${row.paid.toLocaleString()}` : '—'}
            </p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: row.remaining < 0 ? '#B91C1C' : 'var(--color-text-primary)', margin: 0 }}>
              {row.budgeted > 0 ? `$${row.remaining.toLocaleString()}` : '—'}
            </p>
          </div>
          )
        })}
      </Card>
    </AppShell>
  )
}
