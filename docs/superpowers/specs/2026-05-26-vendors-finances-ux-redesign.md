# Vendors + Finances UX Redesign
**Date:** 2026-05-26
**Status:** Approved
**Scope:** `src/pages/Vendors.tsx`, `src/pages/Finances.tsx`

---

## Problem Statement

The current Vendors and Finances pages lack visual hierarchy and information density. Key issues:

- **Vendors:** No visual distinction between booking stages, no summary of progress, tiles show too little metadata and too much whitespace
- **Finances:** Budget data scattered across 4 separate stat cards plus a duplicated "next due" display, payment schedule buried below redundant information, family split not discoverable

---

## Approved Design: Vendors Page

### Visual System — 3 States Only

| State | Tile background | Border | Title color | Label |
|-------|----------------|--------|-------------|-------|
| Booked | `#f0faf0` | `1.5px solid #a5d6a7` | `#1b5e20` (dark green) | Green "BOOKED" badge |
| In Progress (any sub-status) | `#fdf5f7` | `1px solid #e8c4ce` | `#2c2825` (dark) | Rose count badge + sub-status text |
| Not Started | `#f5f5f5` | `1px solid #e0e0e0` | `#2c2825` (dark, readable) | — |

**Key decision:** Not-started tiles use a grey background but **black text** so users still clearly see they need to act. No text muting.

"In progress" is a single rose color for *all* sub-statuses (researching, shortlisted, meeting_scheduled). The sub-status text line (e.g., "2 shortlisted", "Meeting Friday") carries the detail.

### Summary Bar

A single row tile above the grid showing:
- `X/N Booked` (large number with `/N` in muted grey) + "BOOKED" label
- Progress bar (green fill = booked fraction)
- `N Active` (rose colored) + "ACTIVE" label
- `N To do` (grey) + "TO DO" label

### Grid Layout

- 3 columns (`grid-template-columns: 1fr 1fr 1fr`)
- `gap: 7px`
- Tiles: `padding: 9px 11px; border-radius: 8px`
- Category name: `font-size: 12px; font-weight: 700` (booked) or `600` (in-progress/not-started)
- Sub-status line: `font-size: 11px`
- Badge: top-right corner, `font-size: 9px`

### Reference

Approved mockup: `.superpowers/brainstorm/54138-1779832449/content/vendors-final-v2.html`

Vendor categories (14 total): Venue, Hair & Makeup, Photographer, Band/DJ, Caterer, Florist, Videographer, Cake & Desserts, Transportation, Invitations, Lighting, Rehearsal Dinner, Hotels, Wedding Planner

---

## Approved Design: Finances Page

### Consolidated Summary Tile (replaces 4 separate stat cards)

Single card containing:

1. **Headline row** (space-between):
   - Left: "Total Budget" label + large dollar amount (`$47,500`, `font-size: 26px; font-weight: 700; font-family: Georgia`)
   - Right: "Next due" label + `$5,000 Jun 7` in rose/pink

2. **3-part progress bar** (`height: 8px`):
   - Green segment (% paid)
   - Rose segment (% scheduled/upcoming)
   - `#f0ede8` segment (% remaining)
   - `gap: 2px` between segments, `border-radius: 4px`

3. **Legend row** (3 items, each with a colored square dot):
   - Green dot → `$14,250` / "Paid"
   - Rose dot → `$10,700` / "Scheduled"
   - Grey dot → `$22,550` / "Remaining"

### Alert Banner

Shown conditionally: only when a payment is overdue or due within 30 days.

- `border: 1px solid #fcd5d5; background: #fff5f5`
- Warning emoji + bold red headline "Payment due in N days"
- Vendor name + amount + due date

### Section Order (top to bottom)

1. Page header ("Finances" + subtitle)
2. Consolidated summary tile
3. Alert banner (conditional)
4. **By Family** section (moved above payment schedule)
5. Payment Schedule (renamed from "Upcoming Payments")
6. "+ Add Payment" button

### By Family Cards

2-column grid, each card shows:
- Family label (ALL CAPS, muted)
- Total contribution (Georgia serif, `font-size: 20px`)
- Line-item list with horizontal rule separators

### Payment Schedule Rows

Color-coded by urgency:
- **Overdue:** `background: #fff5f5` row, red "Overdue" badge, red amount, "Pay" button with red border
- **Due soon (≤30 days):** `background: #fffbf4` row, amber "N days" badge, amber amount
- **Future:** White background, neutral amount, muted "Pay" button

Each row: vendor name (bold) + sub-label (vendor company · due date), amount (right), "Pay" button (far right).

### Reference

Approved mockup: `.superpowers/brainstorm/54138-1779832449/content/finances-v2.html`

---

## Implementation Constraints

- **Do not change routing, data model, or Supabase queries** — this is a pure UI/layout change
- **Preserve all existing functionality** (pay buttons, add payment form, vendor click-through)
- **Responsive:** The 3-col vendor grid should collapse to 2-col below 480px
- **Design tokens:** Use existing CSS custom properties where available (`--color-accent` = `#c4788a`, etc.)
- **No new dependencies** — plain React + Tailwind or inline styles consistent with the existing codebase pattern

---

## Out of Scope

- Dashboard page changes
- Timeline/Checklist page changes
- Mobile-first responsive overhaul (basic responsiveness only)
- Animation or micro-interactions
- Any changes to AI shortlist behavior or backend
