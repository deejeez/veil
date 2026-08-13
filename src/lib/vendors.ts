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

// Concurrent seeds for the same couple would each read "nothing exists" and
// each insert the full set — React StrictMode double-invokes effects, and both
// Dashboard and Vendors call this. `vendors` deliberately has no unique
// constraint on (couple_id, category) because a category holds several vendors
// while you compare them, so the database can't reject the duplicate for us.
// Sharing the in-flight promise collapses the overlapping calls instead.
const seedsInFlight = new Map<string, Promise<void>>()

// Ensure all categories have placeholder vendor rows. Accepts a custom slug list
// (when categories are DB-driven); falls back to the hardcoded defaults.
export async function seedDefaultVendorCategories(coupleId: string, slugs?: string[]) {
  const key = `${coupleId}:${(slugs ?? []).join(',')}`
  const inFlight = seedsInFlight.get(key)
  if (inFlight) return inFlight

  const run = (async () => {
    const targets = slugs ?? [...VENDOR_CATEGORIES]
    const existing = await getVendorsForCouple(coupleId)
    const existingCategories = new Set(existing.map(v => v.category))
    const missing = targets.filter(c => !existingCategories.has(c))
    if (missing.length === 0) return

    const { error } = await supabase.from('vendors').insert(
      missing.map(category => ({ couple_id: coupleId, category, status: 'not_started' }))
    )
    if (error) throw error
  })()

  seedsInFlight.set(key, run)
  try {
    await run
  } finally {
    seedsInFlight.delete(key)
  }
}

/**
 * Marks a category booked during onboarding, reusing the placeholder row for
 * that category rather than adding another one.
 *
 * A category legitimately holds several vendors — you compare three
 * photographers and book one — so `vendors` has no unique constraint on
 * (couple_id, category) and `upsertVendor` therefore inserts every time.
 * During onboarding that produced a second booked row for the same category,
 * which double-counted booked_amount in the budget breakdown and made the
 * dashboard's vendor tile disagree with everything else on the page.
 */
export async function markCategoryBooked(
  coupleId: string,
  category: string,
  name?: string | null,
  { overwriteName = false }: { overwriteName?: boolean } = {},
) {
  const { data: existing } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('couple_id', coupleId)
    .eq('category', category)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const trimmed = name?.trim() || null

  if (existing?.id) {
    // By default only fill the name in when the row hasn't got one: callers
    // like the step 3 tiles pass generic category labels ("Venue"), which must
    // not overwrite a real name the couple typed ("Liberty Warehouse").
    // overwriteName is for callers whose name *is* the couple's own input.
    const shouldSetName = trimmed && (overwriteName || !existing.name?.trim())
    const { error } = await supabase
      .from('vendors')
      .update({ status: 'booked', ...(shouldSetName ? { name: trimmed } : {}) })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('vendors')
      .insert({ couple_id: coupleId, category, name: trimmed, status: 'booked' })
    if (error) throw error
  }
}

/**
 * Records a booked venue captured during onboarding.
 *
 * The app stores "the venue" in two places that historically didn't agree:
 *   - a `vendors` row with category 'venue' — what the Venue page reads
 *   - `couples.venue_name` — what timeline status and the RightPanel
 *     "Venue secured" checklist read
 *
 * Writing only one leaves half the UI thinking there's no venue.
 */
export async function setBookedVenue(coupleId: string, venueName: string) {
  const name = venueName.trim()
  if (!name) return

  await markCategoryBooked(coupleId, 'venue', name, { overwriteName: true })

  const { error: coupleError } = await supabase
    .from('couples')
    .update({ venue_name: name })
    .eq('id', coupleId)
  if (coupleError) throw coupleError
}
