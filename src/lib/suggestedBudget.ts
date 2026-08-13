import { VENDOR_CATEGORY_LABELS, type VendorCategory } from '../types/database'

/**
 * A starting budget allocation, so the Budget Breakdown shows something useful
 * on day one instead of a $0 donut and "No commitments yet".
 *
 * EXPERIENCE-SPEC.md §2a: empty states should propose, not apologise. A couple
 * who has told us their budget shouldn't have to invent the split themselves.
 *
 * Percentages are conventional US wedding splits. They're a conversation
 * starter — the couple adjusts on the Budget page — so they're deliberately
 * round rather than falsely precise.
 */

const ALLOCATION: Record<VendorCategory, number> = {
  venue:                  0.25,
  caterer:                0.22,
  photographer:           0.11,
  band_dj:                0.08,
  florist:                0.08,
  videographer:           0.05,
  wedding_planner:        0.05,
  transportation:         0.03,
  hair_makeup:            0.03,
  rehearsal_dinner:       0.03,
  cake_desserts:          0.02,
  invitations_stationery: 0.02,
  hotels:                 0.02,
  lighting:               0.01,
}

export type SuggestedSlice = {
  category: string
  label: string
  amount: number
  pct: number
}

/**
 * Splits `total` across the categories the couple actually has, renormalising
 * so the slices always sum to the full budget even when their category list has
 * been customised (added or removed categories).
 */
export function suggestedAllocation(
  total: number,
  categorySlugs: string[],
  categoryLabels: Record<string, string> = {},
): SuggestedSlice[] {
  if (!total || total <= 0 || categorySlugs.length === 0) return []

  const weights = categorySlugs.map(slug => ({
    slug,
    weight: ALLOCATION[slug as VendorCategory] ?? 0.02, // custom categories get a small default
  }))
  const weightSum = weights.reduce((s, w) => s + w.weight, 0)
  if (weightSum <= 0) return []

  return weights
    .map(({ slug, weight }) => {
      const pct = weight / weightSum
      return {
        category: slug,
        label: categoryLabels[slug] ?? VENDOR_CATEGORY_LABELS[slug as VendorCategory] ?? slug,
        amount: Math.round((total * pct) / 100) * 100, // nearest $100
        pct: Math.round(pct * 100),
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Collapses a long allocation into the biggest `keep` slices plus an "Other"
 * bucket, so the donut stays readable with 14 categories.
 */
export function topSlices(slices: SuggestedSlice[], keep = 6): SuggestedSlice[] {
  if (slices.length <= keep) return slices
  const head = slices.slice(0, keep)
  const rest = slices.slice(keep)
  const restTotal = rest.reduce((s, x) => s + x.amount, 0)
  const restPct = rest.reduce((s, x) => s + x.pct, 0)
  return [...head, { category: '__other', label: `Other (${rest.length})`, amount: restTotal, pct: restPct }]
}
