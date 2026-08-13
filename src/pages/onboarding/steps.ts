/**
 * Non-component shared values for the onboarding flow.
 *
 * Kept out of chrome.tsx so that file exports only components — mixing the two
 * breaks React Fast Refresh (react-refresh/only-export-components).
 */

export const STEP_LABELS = ['You', 'Date', 'Style', 'Budget'] as const
export const STEP_COUNT = STEP_LABELS.length

export type StepNumber = 1 | 2 | 3 | 4

export const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '6px',
}

/** "Marco & Sarah", or just "Marco" when the partner name is absent. */
export function coupleLine(primary?: string | null, partner?: string | null): string {
  const a = (primary ?? '').trim()
  const b = (partner ?? '').trim()
  if (a && b) return `${a} & ${b}`
  return a || b
}
