import type { Couple, Vendor, Guest, BudgetCategory } from '../types/database'

export type MilestoneStatus = 'done' | 'in_progress' | 'pending'

export type MilestoneInfo = {
  task: string
  status: MilestoneStatus
  /** Vendor category slug to navigate to, or page path like /budget, /guests */
  link?: string
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
  budgetCategories: BudgetCategory[]
): PhaseStatus[] {
  const totalGuests = guests.reduce((s, g) => s + 1 + g.plus_ones + g.kids, 0)
  const hasBudget = (couple?.budget_total ?? 0) > 0 || budgetCategories.some(b => b.budgeted > 0)
  const hasDate = !!couple?.wedding_date
  const hasVenueName = !!couple?.venue_name
  const venueVendorStatus = vendorStatus(vendors, 'venue')

  // "Venue" is considered done if the venue vendor is booked OR the couple has a venue name set
  const venueDone: MilestoneStatus = venueVendorStatus === 'done' || (hasVenueName && venueVendorStatus !== 'pending')
    ? 'done'
    : venueVendorStatus === 'in_progress' || hasVenueName
    ? 'in_progress'
    : 'pending'

  const phases: PhaseStatus[] = [
    {
      id: '12plus',
      label: '12+ months out',
      monthsFrom: 12,
      monthsTo: 36,
      milestones: [
        { task: 'Set a total wedding budget', status: hasBudget ? 'done' : 'pending', link: '/budget' },
        { task: 'Choose your wedding date', status: hasDate ? 'done' : 'pending', link: '/settings' },
        { task: 'Estimate guest count', status: totalGuests > 0 ? 'done' : guests.length > 0 ? 'in_progress' : 'pending', link: '/guests' },
        { task: 'Research and book your venue', status: venueDone, link: '/vendors/venue' },
        { task: 'Consider hiring a wedding planner', status: vendorStatus(vendors, 'wedding_planner'), link: '/vendors/wedding_planner' },
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
        { task: 'Send save-the-dates', status: 'pending' },
        { task: 'Book photographer & videographer', status: allBooked(vendors, ['photographer', 'videographer']), link: '/vendors/photographer' },
        { task: 'Book caterer (or confirm venue catering)', status: vendorStatus(vendors, 'caterer'), link: '/vendors/caterer' },
        { task: 'Book florist', status: vendorStatus(vendors, 'florist'), link: '/vendors/florist' },
        { task: 'Book band or DJ', status: vendorStatus(vendors, 'band_dj'), link: '/vendors/band_dj' },
        { task: 'Start dress / attire shopping', status: 'pending' },
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
        { task: 'Book officiant', status: 'pending' },
        { task: 'Book hair & makeup artists', status: vendorStatus(vendors, 'hair_makeup'), link: '/vendors/hair_makeup' },
        { task: 'Book transportation', status: vendorStatus(vendors, 'transportation'), link: '/vendors/transportation' },
        { task: 'Start planning honeymoon', status: 'pending' },
        { task: 'Finalize wedding party', status: 'pending' },
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
        { task: 'Send formal invitations (8–10 weeks before)', status: 'pending' },
        { task: 'Register for gifts', status: 'pending' },
        { task: 'Schedule menu tasting with caterer', status: 'pending' },
        { task: 'Order wedding cake', status: vendorStatus(vendors, 'cake_desserts'), link: '/vendors/cake_desserts' },
        { task: 'Plan rehearsal dinner', status: vendorStatus(vendors, 'rehearsal_dinner'), link: '/vendors/rehearsal_dinner' },
        { task: 'Arrange accommodations for out-of-town guests', status: vendorStatus(vendors, 'hotels'), link: '/vendors/hotels' },
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
        { task: 'Confirm all vendor bookings', status: 'pending' },
        { task: 'Obtain marriage license', status: 'pending' },
        { task: 'Final dress / suit fitting', status: 'pending' },
        { task: 'Create seating chart', status: 'pending' },
        { task: 'Write vows', status: 'pending' },
        { task: 'Book honeymoon flights & hotel', status: 'pending' },
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
        { task: 'Confirm day-of timeline with all vendors', status: 'pending' },
        { task: 'Final headcount to caterer', status: 'pending' },
        { task: 'Pack for honeymoon', status: 'pending' },
        { task: 'Prepare emergency kit (safety pins, stain pen, mints)', status: 'pending' },
        { task: 'Enjoy your rehearsal dinner', status: 'pending' },
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
  budgetCategories: BudgetCategory[]
): string {
  const vendorSig = vendors.map(v => `${v.category}:${v.status}`).sort().join(',')
  const guestSig = guests.length.toString()
  const budgetSig = (couple?.budget_total ?? 0).toString() + ':' + budgetCategories.map(b => `${b.category}:${b.budgeted}`).sort().join(',')
  const coupleSig = `${couple?.wedding_date ?? ''}:${couple?.venue_name ?? ''}:${couple?.budget_total ?? ''}`
  return [coupleSig, vendorSig, guestSig, budgetSig].join('|')
}
