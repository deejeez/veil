import { supabase } from './supabase'
import type { BudgetCategory, Vendor, Payment } from '../types/database'

export async function getBudgetCategories(coupleId: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('couple_id', coupleId)
  if (error) throw error
  return data as BudgetCategory[]
}

export async function upsertBudgetCategory(
  coupleId: string,
  category: string,
  budgeted: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('budget_categories')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('category', category)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('budget_categories').update({ budgeted }).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('budget_categories').insert({ couple_id: coupleId, category, budgeted })
    if (error) throw error
  }
}

export function computeBudgetSummary(
  budgetCategories: BudgetCategory[],
  vendors: Vendor[],
  payments: Payment[]
) {
  return budgetCategories.map(bc => {
    const booked = vendors
      .filter(v => v.category === bc.category && v.status === 'booked')
      .reduce((sum, v) => sum + (v.booked_amount ?? 0), 0)
    const paid = payments
      .filter(p => p.paid_date && vendors.find(v => v.id === p.vendor_id && v.category === bc.category))
      .reduce((sum, p) => sum + p.amount, 0)
    return {
      ...bc,
      booked,
      paid,
      remaining: booked > 0 ? booked - paid : bc.budgeted,
    }
  })
}

// ── Range <-> total ─────────────────────────────────────────────────────────
//
// Onboarding asks for a *range* because most couples don't have an exact number
// early on. The rest of the app works off `budget_total` — the dashboard ring,
// "% committed", paid %, RightPanel health, and timeline status all read it.
//
// Nothing used to convert range -> total, so the onboarding answer was collected
// and then effectively discarded; the dashboard still read "Set in Settings".

export const BUDGET_RANGES = [
  { value: 'under_25k',    label: 'Under $25,000' },
  { value: '25k_50k',      label: '$25,000 – $50,000' },
  { value: '50k_100k',     label: '$50,000 – $100,000' },
  { value: '100k_150k',    label: '$100,000 – $150,000' },
  { value: '150k_250k',    label: '$150,000 – $250,000' },
  { value: 'over_250k',    label: 'Over $250,000' },
] as const

export type BudgetRange = typeof BUDGET_RANGES[number]['value']

// Midpoint of each range, except the two open-ended buckets where no midpoint
// exists. A starting point the couple refines in Settings — not a number we
// pretend they gave us.
const RANGE_TO_TOTAL: Record<string, number> = {
  under_25k:   20_000,
  '25k_50k':   37_500,
  '50k_100k':  75_000,
  '100k_150k': 125_000,
  '150k_250k': 200_000,
  over_250k:   300_000,
}

export function budgetRangeToTotal(range: string | null | undefined): number | null {
  if (!range) return null
  return RANGE_TO_TOTAL[range] ?? null
}

export function deriveBudgetRange(total: number): BudgetRange {
  if (total < 25_000)  return 'under_25k'
  if (total < 50_000)  return '25k_50k'
  if (total < 100_000) return '50k_100k'
  if (total < 150_000) return '100k_150k'
  if (total < 250_000) return '150k_250k'
  return 'over_250k'
}
