import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import { MultiSegmentRing } from '../components/MultiSegmentRing'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getBudgetCategories, upsertBudgetCategory, computeBudgetSummary } from '../lib/budget'
import { getVendorsForCouple } from '../lib/vendors'
import { getPaymentsForCouple } from '../lib/payments'
import { type Couple } from '../types/database'
import { getCategoriesForCouple, type VendorCategoryConfig } from '../lib/categories'
import { suggestedAllocation } from '../lib/suggestedBudget'

const CATEGORY_COLORS = ['#B8926A', '#7B8F6B', '#6B8FAE', '#9B7FA6', '#5A8F8F', '#C4785C', '#C4A5A8']



type BudgetRow = {
  id: string
  couple_id: string
  category: string
  budgeted: number
  booked: number
  paid: number
  remaining: number
}

function BudgetDonutCard({
  rows,
  vendorCategories,
  suggestions,
  showSuggestions,
  totalBudget,
}: {
  rows: BudgetRow[]
  vendorCategories: VendorCategoryConfig[]
  suggestions: Record<string, number>
  showSuggestions: boolean
  totalBudget: number
}) {
  const segments = showSuggestions
    ? Object.entries(suggestions)
        .filter(([_slug, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([slug, amount], i) => ({
          value: amount,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          label: vendorCategories.find(c => c.slug === slug)?.label ?? slug,
        }))
    : rows
        .filter(r => r.budgeted > 0)
        .map((r, i) => ({
          value: r.budgeted,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          label: vendorCategories.find(c => c.slug === r.category)?.label ?? r.category,
        }))

  const total = showSuggestions
    ? Object.values(suggestions).reduce((sum, v) => sum + v, 0)
    : rows.reduce((sum, r) => sum + r.budgeted, 0)

  return (
    <Card>
      <SectionLabel>{showSuggestions ? 'Suggested Allocation' : 'Budget Allocation'}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MultiSegmentRing data={segments} size={140} strokeWidth={20}>
          <div style={{ textAlign: 'center' }}>
            <p className="currency currency-sm" style={{
              color: showSuggestions ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
              margin: '0 0 2px 0',
            }}>
              {total > 0 ? `$${(total / 1000).toFixed(0)}K` : '$0'}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {showSuggestions ? 'suggested' : 'budget'}
            </p>
          </div>
        </MultiSegmentRing>
        {segments.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '12px 0 0 0', textAlign: 'center' }}>
            No budget allocated yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
            {segments.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}
        {!showSuggestions && totalBudget > 0 && total > totalBudget && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#C4785C', margin: '10px 0 0 0', textAlign: 'center', lineHeight: 1.4 }}>
            Your category allocations (${(total / 1000).toFixed(0)}K) exceed your total budget (${(totalBudget / 1000).toFixed(0)}K) by ${((total - totalBudget) / 1000).toFixed(0)}K.
          </p>
        )}
      </div>
    </Card>
  )
}

// "$0" rather than "$0.0K", and no trailing ".0" on whole thousands — the
// stat cards read as broken when an untouched budget shows "$0.0K".
function formatK(amount: number): string {
  if (!amount) return '$0'
  const k = amount / 1000
  if (Math.abs(k) < 1) return `$${Math.round(amount).toLocaleString()}`
  const rounded = Math.round(k * 10) / 10
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}K`
}

export default function Budget() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [vendorCategories, setVendorCategories] = useState<VendorCategoryConfig[]>([])
  const [allPaidTotal, setAllPaidTotal] = useState(0)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingCategory, setSavingCategory] = useState<string | null>(null)
  const [applyingAll, setApplyingAll] = useState(false)

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)

      const [vendorCats, categories, vendors, payments] = await Promise.all([
        getCategoriesForCouple(c.id),
        getBudgetCategories(c.id),
        getVendorsForCouple(c.id),
        getPaymentsForCouple(c.id),
      ])

      setVendorCategories(vendorCats)

      const existingCats = new Set(categories.map(bc => bc.category))
      for (const cat of vendorCats) {
        if (!existingCats.has(cat.slug)) {
          categories.push({ id: '', couple_id: c.id, category: cat.slug, budgeted: 0 })
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

  // Derived values — computed before handlers so they can be referenced
  const totalBudgeted = rows.reduce((sum, r) => sum + r.budgeted, 0)
  const totalBooked = rows.reduce((sum, r) => sum + r.booked, 0)
  const totalPaid = allPaidTotal
  const effectiveBudget = couple?.budget_total ?? totalBudgeted
  const commitPercent = effectiveBudget > 0 ? Math.round((totalBooked / effectiveBudget) * 100) : 0

  const showSuggestions = totalBudgeted === 0 && (couple?.budget_total ?? 0) > 0
  // Shares lib/suggestedBudget with the dashboard donut. They used to hold
  // separate percentage tables that disagreed (venue 30% here, 25% there), so
  // the same couple saw a different suggested split on each page.
  const suggestions: Record<string, number> = {}
  if (showSuggestions && couple?.budget_total) {
    for (const slice of suggestedAllocation(
      couple.budget_total,
      vendorCategories.map(c => c.slug),
      Object.fromEntries(vendorCategories.map(c => [c.slug, c.label])),
    )) {
      suggestions[slice.category] = slice.amount
    }
  }

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

  async function handleAcceptSuggestion(category: string) {
    if (!couple) return
    const amount = suggestions[category]
    if (!amount) return
    setSavingCategory(category)
    try {
      await upsertBudgetCategory(couple.id, category, amount)
      await load()
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setSavingCategory(null)
    }
  }

  async function handleAcceptAll() {
    if (!couple) return
    setApplyingAll(true)
    try {
      await Promise.all(
        Object.entries(suggestions).map(([cat, amount]) =>
          upsertBudgetCategory(couple.id, cat, amount)
        )
      )
      await load()
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setApplyingAll(false)
    }
  }

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, marginBottom: '8px' }}>
        Budget
      </h1>

      {commitPercent >= 100 && (
        <div style={{ padding: '12px 16px', background: 'rgba(196,120,92,0.08)', border: '1px solid rgba(196,120,92,0.30)', borderRadius: '12px', marginBottom: '20px', fontFamily: 'var(--font-body)', fontSize: '14px', color: '#C4785C' }}>
          Budget exceeded — committed {commitPercent}% of total
        </div>
      )}
      {commitPercent >= 90 && commitPercent < 100 && (
        <div style={{ padding: '12px 16px', background: 'rgba(154,120,64,0.08)', border: '1px solid var(--color-status-short)', borderRadius: '12px', marginBottom: '20px', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-status-short)' }}>
          Approaching budget — {commitPercent}% committed
        </div>
      )}

      {/* Smart defaults banner — shown when budget_total is set but nothing allocated yet */}
      {showSuggestions && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(184,146,106,0.07)',
          border: '1px solid rgba(184,146,106,0.25)',
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
                Not sure how to split your budget? Here's a starting point{couple?.city ? ` based on ${couple.city} averages` : ''}.
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                These are typical allocations for a{couple?.budget_total ? ` $${(couple.budget_total / 1000).toFixed(0)}K` : ''} wedding{couple?.city ? ` in ${couple.city}` : ''}. Adjust to match your priorities.
              </p>
            </div>
            <button
              onClick={handleAcceptAll}
              disabled={applyingAll}
              style={{
                fontFamily: 'var(--font-body)', fontSize: '12px', padding: '7px 16px',
                background: 'var(--color-accent)', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: applyingAll ? 'default' : 'pointer',
                opacity: applyingAll ? 0.7 : 1, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {applyingAll ? 'Applying...' : 'Apply all'}
            </button>
          </div>
        </div>
      )}

      {/* Top section: stat cards (2×2) + donut chart */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-[20px]" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { label: 'Total Budget', value: formatK(effectiveBudget) },
            { label: 'Committed', value: formatK(totalBooked) },
            { label: 'Paid', value: formatK(totalPaid) },
            { label: 'Remaining', value: totalBooked > 0 ? formatK(totalBooked - totalPaid) : '—' },
          ].map(({ label, value }) => (
            <Card key={label}>
              <SectionLabel>{label}</SectionLabel>
              <p className="currency currency-lg" style={{ margin: 0 }}>{value}</p>
            </Card>
          ))}
        </div>
        <BudgetDonutCard
          rows={rows}
          vendorCategories={vendorCategories}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          totalBudget={effectiveBudget}
        />
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div className="table-scroll-container">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', marginBottom: '8px', minWidth: '420px' }}>
          {['Category', 'Budgeted', 'Booked', 'Paid', 'Remaining'].map(h => (
            <p key={h} style={{ fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: 0 }}>{h}</p>
          ))}
        </div>

        {rows.map(row => {
          const bookedPercent = row.budgeted > 0 ? Math.min(100, Math.round((row.booked / row.budgeted) * 100)) : 0
          const isOver = row.booked > 0 && row.booked > row.budgeted && row.budgeted > 0
          const isEmpty = row.budgeted === 0 && row.booked === 0 && row.paid === 0
          const suggestion = suggestions[row.category]
          const isSaving = savingCategory === row.category

          return (
            <div
              key={row.category}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px',
                padding: '10px 0', borderBottom: '1px solid var(--color-bg)',
                alignItems: 'center', minWidth: '420px',
                // Don't dim rows when suggestions are showing — they all look "empty" by the old definition
                opacity: isEmpty && !showSuggestions ? 0.5 : 1,
              }}
            >
              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
                  {vendorCategories.find(c => c.slug === row.category)?.label ?? row.category}
                </p>
                {row.budgeted > 0 && (
                  <div style={{ height: '5px', background: '#f0ebe4', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
                    <div style={{ height: '100%', width: `${bookedPercent}%`, background: isOver ? '#C4785C' : 'var(--color-accent)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                  </div>
                )}
              </div>

              {/* Budgeted column: edit input, suggestion with Accept/Adjust, or plain value */}
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
              ) : showSuggestions && suggestion !== undefined ? (
                <div>
                  <p className="currency currency-sm" style={{ color: 'var(--color-text-secondary)', margin: '0 0 4px 0', fontStyle: 'italic' }}>
                    ${suggestion.toLocaleString()}
                  </p>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={() => handleAcceptSuggestion(row.category)}
                      disabled={isSaving}
                      style={{
                        fontFamily: 'var(--font-body)', fontSize: '10px', padding: '2px 8px',
                        background: 'var(--color-accent)', color: '#fff', border: 'none',
                        borderRadius: '6px', cursor: isSaving ? 'default' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => { setEditingCategory(row.category); setEditValue(String(suggestion)) }}
                      style={{
                        fontFamily: 'var(--font-body)', fontSize: '10px', padding: '2px 8px',
                        background: 'none', color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Adjust
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className="currency currency-sm"
                  onClick={() => { setEditingCategory(row.category); setEditValue(String(row.budgeted)) }}
                  style={{ color: 'var(--color-text-primary)', margin: 0, cursor: 'pointer' }}
                  title="Click to edit"
                >
                  {row.budgeted > 0 ? `$${row.budgeted.toLocaleString()}` : '—'}
                </p>
              )}

              <p className="currency currency-sm" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                {row.booked > 0 ? `$${row.booked.toLocaleString()}` : '—'}
              </p>
              <p className="currency currency-sm" style={{ color: 'var(--color-status-booked)', margin: 0 }}>
                {row.paid > 0 ? `$${row.paid.toLocaleString()}` : '—'}
              </p>
              <p className="currency currency-sm" style={{ color: row.remaining < 0 ? '#C4785C' : 'var(--color-text-primary)', margin: 0 }}>
                {row.booked > 0 || row.budgeted > 0 ? `$${row.remaining.toLocaleString()}` : '—'}
              </p>
            </div>
          )
        })}
        </div>{/* end table-scroll-container */}
      </Card>
    </AppShell>
  )
}
