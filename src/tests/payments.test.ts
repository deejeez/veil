import { describe, it, expect } from 'vitest'
import { getUpcomingPayments } from '../lib/payments'
import type { Payment } from '../types/database'

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    couple_id: 'c1',
    vendor_id: null,
    label: 'Deposit',
    amount: 5000,
    due_date: '2027-01-01',
    paid_date: null,
    paid_by: 'couple',
    notes: null,
    status: 'upcoming',
    payment_method: null,
    ...overrides,
  }
}

describe('getUpcomingPayments', () => {
  it('filters out already paid payments', () => {
    const payments = [
      makePayment({ id: 'p1', due_date: '2027-01-01', paid_date: '2026-12-01', status: 'paid' }),
      makePayment({ id: 'p2', due_date: '2027-02-01', paid_date: null }),
    ]
    const result = getUpcomingPayments(payments)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p2')
  })

  it('filters out past due dates', () => {
    const payments = [
      makePayment({ id: 'p1', due_date: '2020-01-01', paid_date: null }),
      makePayment({ id: 'p2', due_date: '2027-01-01', paid_date: null }),
    ]
    const result = getUpcomingPayments(payments)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p2')
  })

  it('limits to 3 results by default', () => {
    const payments = Array.from({ length: 5 }, (_, i) =>
      makePayment({ id: `p${i}`, due_date: `2027-0${i + 1}-01` })
    )
    expect(getUpcomingPayments(payments)).toHaveLength(3)
  })
})
