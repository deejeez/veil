import { supabase } from './supabase'
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from '../types/database'

export type VendorCategoryConfig = {
  id: string
  couple_id: string
  slug: string
  label: string
  sort_order: number
}

// Hardcoded fallback used when the vendor_categories table doesn't exist yet.
function hardcodedDefaults(coupleId: string): VendorCategoryConfig[] {
  return VENDOR_CATEGORIES.map((slug, i) => ({
    id: '',
    couple_id: coupleId,
    slug,
    label: VENDOR_CATEGORY_LABELS[slug],
    sort_order: i,
  }))
}

// Returns ordered categories for a couple, seeding defaults on first call.
// Falls back to hardcoded defaults if the vendor_categories table doesn't exist yet.
export async function getCategoriesForCouple(coupleId: string): Promise<VendorCategoryConfig[]> {
  const { data, error } = await supabase
    .from('vendor_categories')
    .select('*')
    .eq('couple_id', coupleId)
    .order('sort_order', { ascending: true })

  if (error) {
    // 42P01 = table does not exist — migration not applied yet, use hardcoded defaults.
    if ((error as { code?: string }).code === '42P01') return hardcodedDefaults(coupleId)
    throw error
  }

  if (!data || data.length === 0) {
    const defaults = VENDOR_CATEGORIES.map((slug, i) => ({
      couple_id: coupleId,
      slug,
      label: VENDOR_CATEGORY_LABELS[slug],
      sort_order: i,
    }))
    // Two callers on first load can both see zero rows and both insert. A plain
    // insert makes the loser throw on the (couple_id, slug) unique constraint,
    // which left the dashboard with no categories at all. Ignore duplicates and
    // re-read so both callers get the full set either way.
    const { error: insertError } = await supabase
      .from('vendor_categories')
      .upsert(defaults, { onConflict: 'couple_id,slug', ignoreDuplicates: true })
    if (insertError) throw insertError

    const { data: seeded, error: reselectError } = await supabase
      .from('vendor_categories')
      .select('*')
      .eq('couple_id', coupleId)
      .order('sort_order', { ascending: true })
    if (reselectError) throw reselectError
    return (seeded ?? []) as VendorCategoryConfig[]
  }

  return data as VendorCategoryConfig[]
}

// Adds a new custom category. Derives a slug from the label.
// Requires the vendor_categories migration to have been applied.
export async function addCategory(coupleId: string, label: string): Promise<VendorCategoryConfig> {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

  const { data: existing } = await supabase
    .from('vendor_categories')
    .select('sort_order')
    .eq('couple_id', coupleId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const sort_order = existing && existing.length > 0 ? existing[0].sort_order + 1 : 14

  const { data, error } = await supabase
    .from('vendor_categories')
    .insert({ couple_id: coupleId, slug, label, sort_order })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '42P01') throw new Error('Apply the vendor_categories migration in Supabase first.')
    if ((error as { code?: string }).code === '23505') throw new Error(`A category named "${label}" already exists.`)
    throw error
  }

  // Create placeholder vendor row so the category appears everywhere immediately.
  await supabase.from('vendors').insert({ couple_id: coupleId, category: slug, status: 'not_started' })

  return data as VendorCategoryConfig
}

// Renames a category (slug stays the same; all vendor rows already use the slug).
export async function updateCategoryLabel(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('vendor_categories').update({ label }).eq('id', id)
  if (error) throw error
}

// Deletes a category if it has no real vendor data. Returns { ok, reason? }.
export async function deleteCategory(
  id: string,
  slug: string,
  coupleId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, status')
    .eq('couple_id', coupleId)
    .eq('category', slug)

  if (vendors) {
    const hasRealData = vendors.some(v => v.name || v.status !== 'not_started')
    if (hasRealData) {
      return { ok: false, reason: 'Remove all vendors in this category first.' }
    }
  }

  // Clean up placeholder vendor rows and budget row.
  await supabase.from('vendors').delete().eq('couple_id', coupleId).eq('category', slug)
  await supabase.from('budget_categories').delete().eq('couple_id', coupleId).eq('category', slug)

  const { error } = await supabase.from('vendor_categories').delete().eq('id', id)
  if (error) throw error

  return { ok: true }
}

/**
 * Persists a couple's own ordering of vendor categories.
 *
 * sort_order already existed and was already populated — the Vendors page just
 * overrode it with a computed sort, so there was no way to express "show me
 * these in the order I care about".
 *
 * Writes sequentially rather than in parallel: these are small lists, and
 * concurrent updates to adjacent rows have no ordering guarantee, which can
 * leave two categories sharing a sort_order.
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('vendor_categories')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
}
