export type VendorStatus = 'not_started' | 'researching' | 'shortlisted' | 'meeting_scheduled' | 'booked' | 'eliminated'

export type VibeProfile = {
  /** Multi-select vibe values from onboarding, e.g. ['classic_elegant', 'modern_minimal'] */
  vibes?: string[]
  aesthetic?: 'romantic' | 'modern' | 'rustic' | 'industrial' | 'maximalist' | 'minimalist'
  formality?: 'black_tie' | 'cocktail' | 'garden_party' | 'casual'
  setting?: 'urban_venue' | 'countryside' | 'beach' | 'ballroom' | 'restaurant'
  vibe_words?: string[]   // 3 selected from grid
  music_style?: 'live_band' | 'dj' | 'acoustic' | 'classical' | 'mixed'
  priority?: 'food' | 'photography' | 'flowers' | 'music' | 'decor'
}

export type Couple = {
  id: string
  created_at: string
  user_id_primary: string
  user_id_partner: string | null
  email_primary: string
  email_partner: string | null
  wedding_date: string | null
  venue_name: string | null
  city: string | null
  state: string | null
  budget_total: number | null
  paid: boolean
  stripe_session_id: string | null
  vibe_profile: VibeProfile | null
  family_a_name: string | null
  family_b_name: string | null
  name_primary: string | null
  name_partner: string | null
  onboarding_complete: boolean
  guest_count: number | null
  target_season: 'spring' | 'summer' | 'fall' | 'winter' | null
  target_year: number | null
  budget_range: string | null
}

export type Vendor = {
  id: string
  couple_id: string
  category: string
  name: string | null
  status: VendorStatus
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  notes: string | null
  booked_amount: number | null
  booked_date: string | null
  contract_url: string | null
  proposal_url: string | null
  created_at: string
}

export type Payment = {
  id: string
  couple_id: string
  vendor_id: string | null
  label: string
  amount: number
  due_date: string | null
  paid_date: string | null
  paid_by: string
  notes: string | null
  status: 'upcoming' | 'paid'
  payment_method: string | null
}

export type BudgetCategory = {
  id: string
  couple_id: string
  category: string
  budgeted: number
}

export type AiReviewFlag = {
  clause: string
  severity: 'info' | 'caution' | 'flag'
  text: string
}

export type AiReviewDateMoney = {
  label: string
  detail: string
}

export type AiReview = {
  status: 'pending' | 'complete' | 'error'
  flags: AiReviewFlag[]
  summary: string
  reviewed_at: string
  dates_money?: AiReviewDateMoney[]
  questions?: string[]
}

export type Contract = {
  id: string
  couple_id: string
  vendor_id: string
  file_path: string
  file_name: string
  uploaded_at: string
  document_type: 'contract' | 'proposal'
  ai_review: AiReview | null
}

export type AiInsightType = 'timeline_check' | 'vendor_shortlist' | 'contract_review'

export type AiInsight = {
  id: string
  couple_id: string
  type: AiInsightType
  content: string
  created_at: string
}

export const VENDOR_CATEGORIES = [
  'venue',
  'band_dj',
  'florist',
  'photographer',
  'videographer',
  'caterer',
  'hair_makeup',
  'cake_desserts',
  'transportation',
  'invitations_stationery',
  'rehearsal_dinner',
  'wedding_planner',
  'hotels',
  'lighting',
] as const

export type VendorCategory = typeof VENDOR_CATEGORIES[number]

export type Task = {
  id: string
  couple_id: string
  title: string
  description: string | null
  due_date: string | null
  completed: boolean
  assigned_to: string
  category: string | null
  created_at: string
}

export type Guest = {
  id: string
  couple_id: string
  name: string
  household: string | null
  side: 'bride' | 'groom' | 'mutual'
  tier: 'a_list' | 'b_list'
  plus_ones: number
  kids: number
  created_at: string
}

export type VendorLineItem = {
  id: string
  couple_id: string
  vendor_id: string
  label: string
  normalized_label: string
  amount: number | null
  quantity: number | null
  unit: string | null
  notes: string | null
  source: 'extracted' | 'manual'
  created_at: string
}

export type VendorNoteType = 'note' | 'call' | 'quote'

export type VendorNote = {
  id: string
  couple_id: string
  vendor_id: string
  text: string
  type: VendorNoteType
  pinned: boolean
  created_at: string
}

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue: 'Venue',
  band_dj: 'Band / DJ',
  florist: 'Florist',
  photographer: 'Photographer',
  videographer: 'Videographer',
  caterer: 'Caterer',
  hair_makeup: 'Hair & Makeup',
  cake_desserts: 'Cake & Desserts',
  transportation: 'Transportation',
  invitations_stationery: 'Invitations & Stationery',
  rehearsal_dinner: 'Rehearsal Dinner',
  wedding_planner: 'Wedding Planner',
  hotels: 'Hotels',
  lighting: 'Lighting',
}
