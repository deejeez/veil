import type { Couple, Vendor, Guest, BudgetCategory } from '../types/database'

export type MilestoneStatus = 'done' | 'in_progress' | 'pending'

export type MilestoneCompletion = {
  milestone_key: string
  completed_at: string
}

export type MilestoneInfo = {
  task: string
  status: MilestoneStatus
  /** Stable key identifying this milestone (used for manual completions) */
  key: string
  /** 'auto' = derived from app data; 'manual' = user checks it off */
  type: 'auto' | 'manual'
  /** Vendor category slug to navigate to, or page path like /guests, /settings */
  link?: string
  /** Tooltip shown on incomplete auto milestones, e.g. "Book a photographer to complete this" */
  tooltip?: string
  /** Badge shown when an auto milestone is complete: "Booked", "Set", "Decided" */
  autoBadge?: string
  /** ISO timestamp when a manual milestone was completed */
  completedAt?: string
}

export type PhaseStatus = {
  id: string
  label: string
  monthsFrom: number
  monthsTo: number
  milestones: MilestoneInfo[]
  /** count of done milestones */
  doneCount: number
  totalCount: number
}

function vendorStatus(vendors: Vendor[], category: string): MilestoneStatus {
  const v = vendors.find(v => v.category === category)
  if (!v || v.status === 'not_started') return 'pending'
  if (v.status === 'booked') return 'done'
  return 'in_progress'
}

function allBooked(vendors: Vendor[], categories: string[]): MilestoneStatus {
  const statuses = categories.map(c => vendorStatus(vendors, c))
  if (statuses.every(s => s === 'done')) return 'done'
  if (statuses.some(s => s === 'done' || s === 'in_progress')) return 'in_progress'
  return 'pending'
}

export function deriveTimelineStatus(
  couple: Couple | null,
  vendors: Vendor[],
  guests: Guest[],
  budgetCategories: BudgetCategory[],
  completions: MilestoneCompletion[] = []
): PhaseStatus[] {
  const totalGuests = guests.reduce((s, g) => s + 1 + g.plus_ones + g.kids, 0)
  const hasBudget = (couple?.budget_total ?? 0) > 0 || budgetCategories.some(b => b.budgeted > 0)
  const hasDate = !!couple?.wedding_date
  const hasVenueName = !!couple?.venue_name
  const venueVendorStatus = vendorStatus(vendors, 'venue')

  const completionMap = new Map(completions.map(c => [c.milestone_key, c.completed_at]))

  /** Manual milestone: done if the user checked it off */
  const manual = (key: string, task: string): MilestoneInfo => ({
    task,
    key,
    type: 'manual',
    status: completionMap.has(key) ? 'done' : 'pending',
    completedAt: completionMap.get(key),
  })

  /** Auto milestone tied to booking a single vendor category */
  const autoVendor = (key: string, task: string, category: string, vendorLabel: string): MilestoneInfo => ({
    task,
    key,
    type: 'auto',
    status: vendorStatus(vendors, category),
    link: `/vendors/${category}`,
    tooltip: `Book a ${vendorLabel} to complete this`,
    autoBadge: 'Booked',
  })

  // "Venue" is considered done if the venue vendor is booked OR the couple has a venue name set
  const venueDone: MilestoneStatus = venueVendorStatus === 'done' || (hasVenueName && venueVendorStatus !== 'pending')
    ? 'done'
    : venueVendorStatus === 'in_progress' || hasVenueName
    ? 'in_progress'
    : 'pending'

  // Wedding planner: deciding NOT to hire one (eliminated) also completes the milestone
  const plannerVendor = vendors.find(v => v.category === 'wedding_planner')
  const plannerEliminated = plannerVendor?.status === 'eliminated'
  const plannerStatus: MilestoneStatus = plannerEliminated ? 'done' : vendorStatus(vendors, 'wedding_planner')

  const phases: PhaseStatus[] = [
    {
      id: '12plus',
      label: '12+ months out',
      monthsFrom: 12,
      monthsTo: 36,
      milestones: [
        { task: 'Set a total wedding budget', key: 'set_budget', type: 'auto', status: hasBudget ? 'done' : 'pending', link: '/settings', tooltip: 'Set a budget to complete this', autoBadge: 'Set' },
        { task: 'Choose your wedding date', key: 'choose_date', type: 'auto', status: hasDate ? 'done' : 'pending', link: '/settings', tooltip: 'Set your wedding date to complete this', autoBadge: 'Set' },
        { task: 'Estimate guest count', key: 'estimate_guests', type: 'auto', status: totalGuests > 0 ? 'done' : guests.length > 0 ? 'in_progress' : 'pending', link: '/guests', tooltip: 'Add guests to complete this', autoBadge: 'Set' },
        { task: 'Research and book your venue', key: 'book_venue', type: 'auto', status: venueDone, link: '/vendors/venue', tooltip: 'Book a venue to complete this', autoBadge: 'Booked' },
        { task: 'Consider hiring a wedding planner', key: 'decide_planner', type: 'auto', status: plannerStatus, link: '/vendors/wedding_planner', tooltip: 'Book or pass on a wedding planner to complete this', autoBadge: plannerEliminated ? 'Decided' : 'Booked' },
      ],
      doneCount: 0,
      totalCount: 0,
    },
    {
      id: '9to12',
      label: '9–12 months out',
      monthsFrom: 9,
      monthsTo: 12,
      milestones: [
        manual('send_save_the_dates', 'Send save-the-dates'),
        { task: 'Book photographer & videographer', key: 'book_photo_video', type: 'auto', status: allBooked(vendors, ['photographer', 'videographer']), link: '/vendors/photographer', tooltip: 'Book a photographer and videographer to complete this', autoBadge: 'Booked' },
        autoVendor('book_caterer', 'Book caterer (or confirm venue catering)', 'caterer', 'caterer'),
        autoVendor('book_florist', 'Book florist', 'florist', 'florist'),
        autoVendor('book_band_dj', 'Book band or DJ', 'band_dj', 'band or DJ'),
        manual('start_dress_shopping', 'Start dress / attire shopping'),
      ],
      doneCount: 0,
      totalCount: 0,
    },
    {
      id: '6to9',
      label: '6–9 months out',
      monthsFrom: 6,
      monthsTo: 9,
      milestones: [
        autoVendor('book_officiant', 'Book officiant', 'officiant', 'officiant'),
        autoVendor('book_hair_makeup', 'Book hair & makeup artists', 'hair_makeup', 'hair & makeup artist'),
        autoVendor('book_transportation', 'Book transportation', 'transportation', 'transportation vendor'),
        manual('plan_honeymoon', 'Start planning honeymoon'),
        manual('finalize_wedding_party', 'Finalize wedding party'),
      ],
      doneCount: 0,
      totalCount: 0,
    },
    {
      id: '3to6',
      label: '3–6 months out',
      monthsFrom: 3,
      monthsTo: 6,
      milestones: [
        manual('order_invitations', 'Send formal invitations (8–10 weeks before)'),
        manual('register_gifts', 'Register for gifts'),
        manual('schedule_menu_tasting', 'Schedule menu tasting with caterer'),
        autoVendor('book_cake', 'Order wedding cake', 'cake_desserts', 'cake & desserts vendor'),
        autoVendor('plan_rehearsal_dinner', 'Plan rehearsal dinner', 'rehearsal_dinner', 'rehearsal dinner venue'),
        autoVendor('arrange_accommodations', 'Arrange accommodations for out-of-town guests', 'hotels', 'hotel block'),
      ],
      doneCount: 0,
      totalCount: 0,
    },
    {
      id: '1to3',
      label: '1–3 months out',
      monthsFrom: 1,
      monthsTo: 3,
      milestones: [
        manual('confirm_vendor_bookings', 'Confirm all vendor bookings'),
        manual('get_marriage_license', 'Obtain marriage license'),
        manual('final_dress_fitting', 'Final dress / suit fitting'),
        manual('assign_seating', 'Create seating chart'),
        manual('write_vows', 'Write vows'),
        manual('book_honeymoon', 'Book honeymoon flights & hotel'),
      ],
      doneCount: 0,
      totalCount: 0,
    },
    {
      id: 'weekof',
      label: 'Week of the wedding',
      monthsFrom: 0,
      monthsTo: 1,
      milestones: [
        manual('create_day_of_timeline', 'Confirm day-of timeline with all vendors'),
        manual('confirm_headcount', 'Final headcount to caterer'),
        manual('pack_honeymoon', 'Pack for honeymoon'),
        manual('prepare_emergency_kit', 'Prepare emergency kit (safety pins, stain pen, mints)'),
        manual('enjoy_rehearsal_dinner', 'Enjoy your rehearsal dinner'),
      ],
      doneCount: 0,
      totalCount: 0,
    },
  ]

  // Compute doneCount / totalCount for each phase
  for (const phase of phases) {
    phase.totalCount = phase.milestones.length
    phase.doneCount = phase.milestones.filter(m => m.status === 'done').length
  }

  return phases
}

export function getCurrentPhaseId(weddingDate: Date): string {
  const diffMonths = (weddingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)
  if (diffMonths >= 12) return '12plus'
  if (diffMonths >= 9) return '9to12'
  if (diffMonths >= 6) return '6to9'
  if (diffMonths >= 3) return '3to6'
  if (diffMonths >= 0) return '1to3'
  return 'weekof'
}

/** Returns a data fingerprint for cache invalidation */
export function buildDataFingerprint(
  couple: Couple | null,
  vendors: Vendor[],
  guests: Guest[],
  budgetCategories: BudgetCategory[],
  completions: MilestoneCompletion[] = []
): string {
  const vendorSig = vendors.map(v => `${v.category}:${v.status}`).sort().join(',')
  const guestSig = guests.length.toString()
  const budgetSig = (couple?.budget_total ?? 0).toString() + ':' + budgetCategories.map(b => `${b.category}:${b.budgeted}`).sort().join(',')
  const coupleSig = `${couple?.wedding_date ?? ''}:${couple?.venue_name ?? ''}:${couple?.budget_total ?? ''}`
  const completionSig = completions.map(c => c.milestone_key).sort().join(',')
  return [coupleSig, vendorSig, guestSig, budgetSig, completionSig].join('|')
}
