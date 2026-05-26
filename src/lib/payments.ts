import { supabase } from './supabase'
import { type Payment } from '../types/database'

export async function getPaymentsForCouple(coupleId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('couple_id', coupleId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return data as Payment[]
}

export async function insertPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
  const { data, error } = await supabase.from('payments').insert(payment).select().single()
  if (error) throw error
  return data as Payment
}

export async function markPaymentPaid(paymentId: string, paidDate: string) {
  const { error } = await supabase
    .from('payments')
    .update({ paid_date: paidDate })
    .eq('id', paymentId)
  if (error) throw error
}

export async function deletePayment(paymentId: string) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) throw error
}

export function getUpcomingPayments(payments: Payment[], limit = 3): Payment[] {
  const today = new Date().toISOString().split('T')[0]
  return payments
    .filter(p => !p.paid_date && (!p.due_date || p.due_date >= today))
    .slice(0, limit)
}

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
