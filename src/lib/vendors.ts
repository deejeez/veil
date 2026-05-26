import { supabase } from './supabase'
import { type Vendor, type VendorStatus, VENDOR_CATEGORIES } from '../types/database'

export async function getVendorsForCouple(coupleId: string): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Vendor[]
}

export async function upsertVendor(vendor: Partial<Vendor> & { couple_id: string; category: string }): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .upsert(vendor)
    .select()
    .single()
  if (error) throw error
  return data as Vendor
}

export async function updateVendorStatus(vendorId: string, status: VendorStatus | string) {
  const { error } = await supabase.from('vendors').update({ status }).eq('id', vendorId)
  if (error) throw error
}

export async function deleteVendor(vendorId: string) {
  const { error } = await supabase.from('vendors').delete().eq('id', vendorId)
  if (error) throw error
}

// Ensure all 14 default categories exist for a couple
export async function seedDefaultVendorCategories(coupleId: string) {
  const existing = await getVendorsForCouple(coupleId)
  const existingCategories = new Set(existing.map(v => v.category))
  const missing = VENDOR_CATEGORIES.filter(c => !existingCategories.has(c))
  if (missing.length === 0) return

  const { error } = await supabase.from('vendors').insert(
    missing.map(category => ({ couple_id: coupleId, category, status: 'not_started' }))
  )
  if (error) throw error
}
