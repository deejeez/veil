# Veil Design System & Redesign Brief

## The Problem With the Current Design

The current UI looks like a SaaS admin panel. Dark navy sidebar, purple accent color, flat white content areas, uniform card weights, no personality. It reads "project management tool" not "wedding planning companion." A couple opening this for the first time should feel warmth, excitement, and clarity, not like they're logging into Jira.

Specific issues:
- **Color palette is wrong.** Dark navy + purple = developer tool energy. Weddings are warm, personal, aspirational.
- **Everything is the same visual weight.** Stat cards, vendor cards, tables, buttons all compete equally. Nothing guides the eye.
- **No emotional texture.** Zero illustrations, no micro-interactions, no celebration moments, no warmth.
- **Right sidebar is static.** Shows identical content (names, countdown, payment) on every page. Wasted real estate.
- **AI Advisor looks like an error banner.** The most valuable feature on the dashboard is styled like a system alert.
- **Empty states are dead ends.** "No pending tasks" with a party emoji is not helpful. Empty states should guide action.
- **Vendor grid is lifeless.** Boxes with text labels. No visual progress, no status richness, no next-action hints.

---

## Design Direction: "Warm Editorial"

Think: a beautifully designed wedding magazine that happens to be interactive. Refined but not cold. Personal but not childish. The aesthetic sits between Aesop (warm minimalism) and Kinfolk magazine (editorial warmth with generous whitespace).

**NOT:** Pinterest-board-pastel-overload. NOT corporate SaaS. NOT generic "modern web app."

---

## Color Palette

Replace the dark navy/purple scheme entirely.

### Primary Palette
- **Background:** `#FDFBF8` (warm off-white, like linen paper)
- **Surface/Cards:** `#FFFFFF` with very subtle warm shadow (`0 1px 3px rgba(140, 120, 100, 0.08), 0 4px 12px rgba(140, 120, 100, 0.05)`)
- **Primary Text:** `#2C2825` (warm near-black, NOT pure black)
- **Secondary Text:** `#7A7168` (warm gray)
- **Muted Text/Labels:** `#A89F95` (taupe)

### Accent Colors
- **Primary Accent:** `#B8926A` (warm gold/champagne, used for CTAs, active states, progress indicators)
- **Primary Accent Hover:** `#A17D55`
- **Secondary Accent:** `#7B8F6B` (sage green, used for success states, "booked" badges, completed items)
- **Alert/Attention:** `#C4785C` (terracotta/warm coral, used sparingly for overdue items, budget warnings)
- **AI Advisor:** `#E8E2D8` background with `#2C2825` text (warm neutral, not a jarring colored banner)

### Sidebar
- **Background:** `#F5F1EC` (warm light gray, NOT dark navy)
- **Active item:** `#B8926A` text or left border accent, with `#EDE8E1` background
- **Inactive item:** `#7A7168` text
- **Logo/Brand:** `#2C2825`

### Status Colors
- **Booked/Done:** `#7B8F6B` (sage green)
- **In Progress/Active:** `#B8926A` (gold)
- **To Do/Not Started:** `#D4CFC8` (warm light gray)
- **Overdue/Warning:** `#C4785C` (terracotta)
- **Researching:** `#8FA3B8` (dusty blue)

---

## Typography

**DO NOT use:** Inter, Roboto, Arial, system fonts, or any generic sans-serif.

### Headings (Page titles, section headers)
- **Font:** `DM Serif Display` (from Google Fonts) or `Playfair Display`
- **Weight:** 400 (regular) for headings; the serif does the work
- **Color:** `#2C2825`
- **Sizing:** Page title 32px, section headers 22px, card headers 17px

### Body Text, Labels, UI Elements
- **Font:** `DM Sans` or `Jost`
- **Weight:** 400 for body, 500 for labels/buttons, 600 for emphasis
- **Color:** `#2C2825` for body, `#7A7168` for secondary
- **Sizing:** Body 15px, labels/captions 13px, small text 12px

### Monospace (for dollar amounts, counts)
- **Font:** `JetBrains Mono` or `DM Mono`
- **Used for:** Budget numbers, payment amounts, countdown numbers
- **This gives financial data a distinct visual identity from body text**

Import in your CSS or HTML head:
```
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

---

## Layout & Spacing

### Three-Column Layout (keep this)
- **Sidebar:** 240px fixed, light warm background
- **Main content:** fluid, max-width 800px, centered with generous padding (40px horizontal, 32px top)
- **Right panel:** 280px fixed, only show when contextually useful (hide on pages where it adds nothing)

### Spacing Scale
Use a consistent 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

### Cards
- Background: `#FFFFFF`
- Border: none (use shadow instead)
- Shadow: `0 1px 3px rgba(140, 120, 100, 0.08), 0 4px 12px rgba(140, 120, 100, 0.05)`
- Border-radius: `12px`
- Padding: `24px`
- On hover (if clickable): lift shadow to `0 2px 8px rgba(140, 120, 100, 0.12), 0 8px 24px rgba(140, 120, 100, 0.08)` with `transform: translateY(-1px)` and `transition: all 0.2s ease`

---

## Component-Specific Redesigns

### Sidebar
- Light background (`#F5F1EC`), not dark navy
- Logo "Veil" in DM Serif Display, warm black
- Subtitle "WEDDING PLANNER" in DM Sans 11px, letterspaced, `#A89F95`
- Nav items: 15px DM Sans 500, `#7A7168` default, `#2C2825` active with `#B8926A` left border (3px)
- Icons: 20px, stroke style (Lucide icons), not filled
- Bottom of sidebar: small "Made with love" in `#A89F95` italic

### Dashboard (Home)
- **Header:** "Marco & Sarah" in DM Serif Display 32px. Below: "325 days until your wedding" in DM Sans 15px `#7A7168`. Add a subtle decorative element (thin horizontal line with a small heart or ring icon centered).
- **Stat cards:** Keep the 4-card row but add warmth. Use the monospace font for numbers. Add a thin progress ring in the accent gold for budget and vendors. Don't use purple rings.
- **AI Planning Advisor:** Restyle completely. Warm neutral background (`#E8E2D8`), rounded 12px, no harsh border. Small sparkle or lightbulb icon. Header "Your Planning Advisor" in DM Sans 14px 600. Body text in DM Sans 15px, styled as a friendly paragraph not italic blockquote. Buttons: primary gold CTA, secondary outlined.
- **Vendor Status section:** Replace the flat horizontal cards with richer cards showing: category icon, vendor name, status badge (color-coded), and a small "next step" hint text. Example: "Photographer | 1 proposal received | Review & compare →"
- **Partner invite:** Keep but soften. Warm card with a small illustration or icon.

### Vendors Page
- **Progress bar:** Replace the flat green bar with a segmented progress indicator. Each segment = a vendor category. Filled segments = booked. Gold fill, not green.
- **Vendor category cards:** These need MUCH more information density. Each card should show:
  - Category name (DM Serif Display, 17px)
  - Status badge (Booked/Active/To Do) with status colors above
  - Vendor name if booked (DM Sans 14px, secondary color)
  - Subtle next-action text ("Add vendors" or "Compare proposals" or "Review contract")
  - On hover: gentle lift and shadow increase
- Cards in a 3-column grid with 16px gap, not touching edge-to-edge

### Venue Page
- This is good structurally. Keep Total Cost / Paid / Remaining cards.
- Use monospace font for dollar amounts
- Add a thin gold progress bar below the 3 cards showing % paid
- Payments section: each payment row should have a small colored dot (green=paid, gold=pending, terracotta=overdue) instead of just text status

### Budget Page
- The table is fine but needs visual hierarchy improvements
- Category names in DM Sans 500 (slightly bolder)
- Dollar amounts in monospace font
- Add thin colored bars in each row showing budgeted vs. booked visually (small inline bar chart)
- Rows with $0 across the board should be visually de-emphasized (lighter text)
- Add hover state on rows to highlight

### Finances Page
- The stacked progress bar is good. Keep it but use the new palette: gold for paid, dusty blue for scheduled, warm gray for remaining
- "By Family" section: add a way to see who's paying what. If it's just "Couple" for now, that's fine, but structure it so adding "Bride's family" and "Groom's family" is easy
- Payment schedule rows: add status dots (same as venue page)

### Timeline Page
- **This is the strongest page. Build on it.**
- The "NOW" badge is good. Make it gold background with warm black text instead of purple.
- Completed phase: keep the strikethrough and green checkmarks but use sage green (`#7B8F6B`)
- Current phase: warm card with very subtle gold left border (4px)
- Future phases: slightly muted card (gray text, lighter background)
- Add a thin vertical connecting line between phases on the left side (timeline rail)
- Phase headers: DM Serif Display, 18px

### Tasks Page
- Empty state should NOT just say "No pending tasks" with an emoji
- Empty state should show: an illustration (or a tasteful icon composition), a message like "Nothing due right now. Here's what's coming up next:" and then preview the next timeline items
- When there ARE tasks: each task card should show source (which vendor or timeline item it came from), due date, and priority level

### Settings Page
- Clean and functional. Main change: use the new typography and card styling
- Section cards with warm shadows instead of flat borders

---

## Micro-interactions & Delight

### Progress Celebrations
- When a vendor is marked as "Booked," show a brief animation (checkmark that draws itself, or a subtle confetti burst in gold/sage)
- When a timeline phase is completed, the phase card does a gentle pulse and the progress updates

### Hover States
- All clickable cards: `translateY(-1px)` with increased shadow, 200ms ease transition
- Buttons: slight background darken on hover, not just color swap
- Sidebar nav items: smooth background-color transition on hover

### Loading States
- Skeleton screens with warm gray shimmer, not cold gray
- AI Advisor content: subtle "thinking" animation (three dots pulsing)

### Transitions
- Page transitions: content fades in with `opacity 0→1` and `translateY(8px→0)`, 300ms ease
- Cards appearing: stagger by 50ms each for a cascade effect on page load

---

## Right Sidebar (Contextual, Not Static)

Stop showing the same widget on every page. Make it contextual:

- **Home:** Countdown + upcoming payments + quick actions
- **Vendors:** Vendor categories remaining + recently updated vendors
- **Venue:** Venue details snapshot (capacity, date, key policies)
- **Budget:** Budget health summary (over/under by category, alerts)
- **Finances:** Payment calendar (next 30 days)
- **Timeline:** "You're here" progress indicator + days until next milestone
- **Tasks:** Related timeline context

If a page doesn't need the sidebar, collapse it and give main content the full width.

---

## Icons

Use **Lucide React** icons throughout. Stroke style, 1.5px stroke width, 20px default size. Do not use filled icons. Keep them in `#7A7168` default, `#2C2825` active.

---

## Buttons

### Primary (CTAs)
- Background: `#B8926A`
- Text: `#FFFFFF`, DM Sans 14px 600
- Border-radius: 8px
- Padding: 12px 24px
- Hover: `#A17D55`
- No hard drop shadow; very subtle `0 1px 2px rgba(0,0,0,0.08)`

### Secondary
- Background: transparent
- Border: 1.5px solid `#D4CFC8`
- Text: `#2C2825`, DM Sans 14px 500
- Hover: background `#F5F1EC`

### Ghost/Text
- No background, no border
- Text: `#B8926A`, DM Sans 14px 500
- Hover: underline or slight background `#F5F1EC`

---

## Badges/Status Pills

- Border-radius: 6px
- Padding: 4px 10px
- Font: DM Sans 12px 600, uppercase, letter-spacing 0.5px
- **Booked:** background `#E8F0E4`, text `#5A7A4A`
- **Active/In Progress:** background `#F0E8DC`, text `#8B6F4E`
- **To Do:** background `#EDEAE6`, text `#8A8179`
- **Overdue:** background `#F4E4DE`, text `#A15E42`
- **Researching:** background `#E2EAF0`, text `#5A7A8F`

---

## Summary: What This Should Feel Like

When a couple opens Veil, it should feel like opening a beautifully designed wedding journal that already knows what they need to do. Warm paper-like backgrounds, elegant serif headings, clear gold accents guiding them through decisions. The tool should feel calm and organized, not busy. Every page answers "what should I do next?" without requiring the couple to figure it out.

It should NOT feel like: a spreadsheet, a to-do app, a CRM, a developer dashboard, or an AI chatbot.
