import { supabase } from './supabase'
import type { VendorNote } from '../types/database'

export async function getVendorNotes(vendorId: string): Promise<VendorNote[]> {
  const { data, error } = await supabase
    .from('vendor_notes')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addVendorNote(note: Omit<VendorNote, 'id' | 'created_at'>): Promise<VendorNote> {
  const { data, error } = await supabase
    .from('vendor_notes')
    .insert(note)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVendorNote(id: string): Promise<void> {
  const { error } = await supabase.from('vendor_notes').delete().eq('id', id)
  if (error) throw error
}

export async function toggleVendorNotePin(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('vendor_notes').update({ pinned }).eq('id', id)
  if (error) throw error
}
