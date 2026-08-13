/**
 * One definition of "how many days until X".
 *
 * This was open-coded in ten places with three different conventions:
 * `new Date(iso)` (parsed as UTC midnight), `new Date(iso + 'T00:00:00')`
 * (local midnight) and `new Date(iso + 'T12:00:00')` (local noon), variously
 * with Math.ceil or Math.round. They disagree by a day depending on the
 * viewer's timezone and the time of day — the payment rows and the wedding
 * countdown could show different numbers for the same date.
 *
 * Both sides are normalised to local midnight and the difference is whole
 * days, so "tomorrow" is 1 all day today rather than flipping at noon.
 */
export function daysUntilDate(iso: string | null | undefined): number | null {
  if (!iso) return null
  // Date-only strings must be read as local, not UTC — `new Date('2027-04-17')`
  // is UTC midnight, which is the previous day in every negative offset.
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
