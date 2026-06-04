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
