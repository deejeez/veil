import { describe, it, expect } from 'vitest'
import { computeBudgetSummary } from '../lib/budget'
import type { BudgetCategory, Vendor, Payment } from '../types/database'

describe('computeBudgetSummary', () => {
  it('computes booked and paid totals per category', () => {
    const budgetCategories: BudgetCategory[] = [
      { id: 'b1', couple_id: 'c1', category: 'venue', budgeted: 20000 },
    ]
    const vendors: Vendor[] = [
      { id: 'v1', couple_id: 'c1', category: 'venue', name: 'Liberty', status: 'booked',
        contact_name: null, contact_email: null, contact_phone: null,
        website: null, notes: null, booked_amount: 15000, created_at: '' },
    ]
    const payments: Payment[] = [
      { id: 'p1', couple_id: 'c1', vendor_id: 'v1', label: 'Deposit',
        amount: 5000, due_date: '2026-01-01', paid_date: '2026-01-01', paid_by: 'couple', notes: null },
    ]

    const result = computeBudgetSummary(budgetCategories, vendors, payments)
    expect(result[0].booked).toBe(15000)
    expect(result[0].paid).toBe(5000)
    expect(result[0].remaining).toBe(5000)
  })

  it('does not count shortlisted vendors in booked', () => {
    const budgetCategories: BudgetCategory[] = [
      { id: 'b1', couple_id: 'c1', category: 'florist', budgeted: 10000 },
    ]
    const vendors: Vendor[] = [
      { id: 'v1', couple_id: 'c1', category: 'florist', name: 'Rose', status: 'shortlisted',
        contact_name: null, contact_email: null, contact_phone: null,
        website: null, notes: null, booked_amount: 8000, created_at: '' },
    ]

    const result = computeBudgetSummary(budgetCategories, vendors, [])
    expect(result[0].booked).toBe(0)
    expect(result[0].remaining).toBe(10000)
  })
})
