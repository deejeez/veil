import { supabase } from './supabase'
import type { VendorLineItem } from '../types/database'

export async function getLineItemsForVendor(vendorId: string): Promise<VendorLineItem[]> {
  const { data, error } = await supabase
    .from('vendor_line_items')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getLineItemsForVendors(vendorIds: string[]): Promise<VendorLineItem[]> {
  if (vendorIds.length === 0) return []
  const { data, error } = await supabase
    .from('vendor_line_items')
    .select('*')
    .in('vendor_id', vendorIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function insertLineItems(items: Omit<VendorLineItem, 'id' | 'created_at'>[]): Promise<VendorLineItem[]> {
  if (items.length === 0) return []
  const { data, error } = await supabase
    .from('vendor_line_items')
    .insert(items)
    .select()
  if (error) throw error
  return data ?? []
}

export async function deleteLineItemsForVendor(vendorId: string): Promise<void> {
  const { error } = await supabase
    .from('vendor_line_items')
    .delete()
    .eq('vendor_id', vendorId)
  if (error) throw error
}

export async function updateLineItem(
  id: string,
  updates: Partial<Pick<VendorLineItem, 'label' | 'normalized_label' | 'amount' | 'quantity' | 'unit' | 'notes'>>
): Promise<void> {
  const { error } = await supabase
    .from('vendor_line_items')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('vendor_line_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}
