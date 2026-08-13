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

// Ensure all categories have placeholder vendor rows. Accepts a custom slug list
// (when categories are DB-driven); falls back to the 14 hardcoded defaults.
export async function seedDefaultVendorCategories(coupleId: string, slugs?: string[]) {
  const targets = slugs ?? [...VENDOR_CATEGORIES]
  const existing = await getVendorsForCouple(coupleId)
  const existingCategories = new Set(existing.map(v => v.category))
  const missing = targets.filter(c => !existingCategories.has(c))
  if (missing.length === 0) return

  const { error } = await supabase.from('vendors').insert(
    missing.map(category => ({ couple_id: coupleId, category, status: 'not_started' }))
  )
  if (error) throw error
}

/**
 * Records a booked venue captured during onboarding.
 *
 * The app stores "the venue" in two places that historically didn't agree:
 *   - a `vendors` row with category 'venue' — what the Venue page reads
 *   - `couples.venue_name` — what timeline status and the RightPanel
 *     "Venue secured" checklist read
 *
 * Writing only one leaves half the UI thinking there's no venue, so this
 * writes both. `vendors` has no unique constraint on (couple_id, category),
 * so upserting would duplicate — we find the existing row and update it.
 */
export async function setBookedVenue(coupleId: string, venueName: string) {
  const name = venueName.trim()
  if (!name) return

  const { data: existing } = await supabase
    .from('vendors')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('category', 'venue')
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('vendors')
      .update({ name, status: 'booked' })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('vendors')
      .insert({ couple_id: coupleId, category: 'venue', name, status: 'booked' })
    if (error) throw error
  }

  const { error: coupleError } = await supabase
    .from('couples')
    .update({ venue_name: name })
    .eq('id', coupleId)
  if (coupleError) throw coupleError
}
