import type { Couple, Vendor, Guest } from '../types/database'

/**
 * Step definitions for the dashboard Getting Started checklist.
 *
 * Kept out of the component file so that file exports only components —
 * mixing the two breaks React Fast Refresh.
 */

export type ChecklistStep = {
  key: string
  title: string
  blurb: string
  done: boolean
  path: string
}

export function buildSteps(
  couple: Couple | null,
  vendors: Vendor[],
  guests: Guest[],
): ChecklistStep[] {
  const isBooked = (c: string) => vendors.some(v => v.category === c && v.status === 'booked')
  return [
    {
      key: 'budget',
      title: 'Confirm your budget',
      blurb: 'Set the number everything else is measured against.',
      done: Boolean(couple?.budget_total && couple.budget_total > 0),
      path: '/budget',
    },
    {
      key: 'venue',
      title: 'Lock in your venue',
      blurb: 'Your venue fixes your date, guest count, and catering options.',
      done: isBooked('venue') || Boolean(couple?.venue_name),
      path: '/vendors/venue',
    },
    {
      key: 'vendors',
      title: 'Start your vendor shortlist',
      blurb: 'Photographer and catering book earliest — begin there.',
      done: vendors.some(v => v.status !== 'not_started' && v.category !== 'venue'),
      path: '/vendors',
    },
    {
      key: 'guests',
      title: 'Add your guest list',
      blurb: 'Guest count drives catering, seating, and half your budget.',
      done: guests.length > 0,
      path: '/guests',
    },
    {
      key: 'partner',
      title: 'Invite your partner',
      blurb: 'Plan together — you\'ll both see the same numbers.',
      done: Boolean(couple?.email_partner),
      path: '/settings',
    },
  ]
}
