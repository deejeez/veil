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

const CATEGORY_COLORS = ['#B8926A', '#7B8F6B', '#6B8FAE', '#9B7FA6', '#5A8F8F', '#C4785C', '#C4A5A8']

// Typical budget allocation percentages by vendor category slug
const BUDGET_SUGGESTIONS: Record<string, number> = {
  venue: 0.30,
  caterer: 0.22,
  photographer: 0.10,
  band_dj: 0.08,
  florist: 0.07,
  videographer: 0.05,
  wedding_planner: 0.05,
  hair_makeup: 0.04,
  cake_desserts: 0.02,
  transportation: 0.02,
  rehearsal_dinner: 0.02,
  invitations_stationery: 0.01,
  hotels: 0.01,
  lighting: 0.01,
}

// NYC absolute dollar suggestions for a ~$200K wedding
const NYC_SUGGESTIONS: Record<string, number> = {
  venue: 70000,
  caterer: 40000,
  photographer: 15000,
  florist: 12000,
  band_dj: 10000,
  videographer: 8000,
  wedding_planner: 8000,
  rehearsal_dinner: 8000,
  hotels: 5000,
  hair_makeup: 5000,
  transportation: 4000,
  lighting: 4000,
  invitations_stationery: 3000,
  cake_desserts: 3000,
}
const NYC_TOTAL = Object.values(NYC_SUGGESTIONS).reduce((a, b) => a + b, 0)

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
}: {
  rows: BudgetRow[]
  vendorCategories: VendorCategoryConfig[]
  suggestions: Record<string, number>
  showSuggestions: boolean
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
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '17px', fontWeight: 700,
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
      </div>
    </Card>
  )
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
  const [nycDismissed, setNycDismissed] = useState(
    () => localStorage.getItem('veil_nyc_banner_dismissed') === '1'
  )
  const [applyingNyc, setApplyingNyc] = useState(false)

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
  const suggestions: Record<string, number> = {}
  if (showSuggestions && couple?.budget_total) {
    for (const [slug, pct] of Object.entries(BUDGET_SUGGESTIONS)) {
      // Round to nearest $500
      suggestions[slug] = Math.round(couple.budget_total * pct / 500) * 500
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

  async function handleNycApplyAll() {
    if (!couple) return
    setApplyingNyc(true)
    try {
      const emptyRows = rows.filter(r => r.budgeted === 0 && NYC_SUGGESTIONS[r.category] !== undefined)
      await Promise.all(
        emptyRows.map(r => upsertBudgetCategory(couple.id, r.category, NYC_SUGGESTIONS[r.category]))
      )
      await load()
    } catch {
      alert('Failed to apply suggestions. Please try again.')
    } finally {
      setApplyingNyc(false)
    }
  }

  async function handleNycAccept(category: string) {
    if (!couple) return
    setSavingCategory(category)
    try {
      await upsertBudgetCategory(couple.id, category, NYC_SUGGESTIONS[category])
      await load()
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setSavingCategory(null)
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

      {/* NYC suggestions banner — shown when not dismissed */}
      {!nycDismissed && (
        <div style={{
          padding: '12px 16px',
          background: '#FBF6F0',
          border: '1px solid rgba(184,146,106,0.3)',
          borderLeft: '4px solid #B8926A',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: '#2c2825', margin: '0 0 2px 0' }}>
              ✦ Suggested allocations for a ${(NYC_TOTAL / 1000).toFixed(0)}K NYC wedding.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Adjust to match your priorities.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleNycApplyAll}
              disabled={applyingNyc}
              style={{ fontFamily: 'var(--font-body)', fontSize: '12px', padding: '6px 14px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '7px', cursor: applyingNyc ? 'default' : 'pointer', opacity: applyingNyc ? 0.7 : 1, fontWeight: 600 }}
            >
              {applyingNyc ? 'Applying...' : 'Apply All'}
            </button>
            <button
              onClick={() => { setNycDismissed(true); localStorage.setItem('veil_nyc_banner_dismissed', '1') }}
              style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >×</button>
          </div>
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
                Here's a typical budget breakdown for a{' '}
                {couple?.budget_total ? `$${(couple.budget_total / 1000).toFixed(0)}K` : ''}{' '}
                wedding{couple?.city ? ` in ${couple.city}` : ''}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Starting points based on typical averages. Accept any row or apply all at once — adjust to match your priorities.
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
            { label: 'Total Budget', value: effectiveBudget > 0 ? `$${(effectiveBudget / 1000).toFixed(0)}K` : '—' },
            { label: 'Committed', value: `$${(totalBooked / 1000).toFixed(1)}K` },
            { label: 'Paid', value: `$${(totalPaid / 1000).toFixed(1)}K` },
            { label: 'Remaining', value: effectiveBudget > 0 ? `$${((effectiveBudget - totalBooked) / 1000).toFixed(1)}K` : '—' },
          ].map(({ label, value }) => (
            <Card key={label}>
              <SectionLabel>{label}</SectionLabel>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '28px', fontWeight: 700, margin: 0 }}>{value}</p>
            </Card>
          ))}
        </div>
        <BudgetDonutCard
          rows={rows}
          vendorCategories={vendorCategories}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
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
          const isOver = row.remaining < 0 && row.budgeted > 0
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

              {/* Budgeted column: edit input | suggestion with Accept/Adjust | nyc ghost | plain value */}
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
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 4px 0', fontStyle: 'italic' }}>
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
              ) : row.budgeted === 0 && !nycDismissed && NYC_SUGGESTIONS[row.category] !== undefined ? (
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: '#C4B8A8', margin: '0 0 4px 0' }}>
                    ${NYC_SUGGESTIONS[row.category].toLocaleString()}
                  </p>
                  <button
                    onClick={() => handleNycAccept(row.category)}
                    disabled={isSaving}
                    style={{
                      fontFamily: 'var(--font-body)', fontSize: '10px', padding: '2px 8px',
                      background: 'none', color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)', borderRadius: '6px',
                      cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? '...' : 'Accept'}
                  </button>
                </div>
              ) : (
                <p
                  onClick={() => { setEditingCategory(row.category); setEditValue(String(row.budgeted)) }}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, cursor: 'pointer' }}
                  title="Click to edit"
                >
                  {row.budgeted > 0 ? `$${row.budgeted.toLocaleString()}` : '—'}
                </p>
              )}

              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                {row.booked > 0 ? `$${row.booked.toLocaleString()}` : '—'}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--color-status-booked)', margin: 0 }}>
                {row.paid > 0 ? `$${row.paid.toLocaleString()}` : '—'}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: row.remaining < 0 ? '#C4785C' : 'var(--color-text-primary)', margin: 0 }}>
                {row.budgeted > 0 ? `$${row.remaining.toLocaleString()}` : '—'}
              </p>
            </div>
          )
        })}
        </div>{/* end table-scroll-container */}
      </Card>
    </AppShell>
  )
}
