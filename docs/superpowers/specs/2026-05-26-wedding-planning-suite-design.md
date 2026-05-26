# Veil — Design Spec
**Date:** 2026-05-26
**Status:** Approved
**Version:** v1 MVP
**App name:** Veil (`veil.ai`)

---

## Problem Statement

Couples planning their own wedding face three acute pain points at the start:

1. **Vendor discovery chaos** — vendors come from The Knot, personal referrals, email intros, Instagram DMs. No single place to track them, compare them, or shortlist them neutrally.
2. **"Are we behind?" anxiety** — generic "12 months before your wedding" checklists don't account for your specific date, what you've already booked, or your city's vendor availability.
3. **Financial opacity** — budget, payments, and who-paid-what (families often split costs) live across spreadsheets, texts, and memory.

A full wedding planner costs $5K–$12K. The 70%+ of couples who don't hire one are doing all of this with scattered tools, none of which talk to each other.

The product: an AI-powered hub that replaces the wedding planner for couples who want to do it themselves, at $149 one-time.

---

## Key Premises

1. **The hub beats point solutions.** Value comes from everything being connected — vendor status auto-flows to budget, payments pull from vendor cards, AI recommendations reference your full profile. Individual AI features (just contract review, just checklists) can't replicate this.

2. **Vendor neutrality is a structural moat.** The Knot and Zola make money on vendor referrals. Every AI recommendation they make is tainted by that. A paid-once product has fully aligned incentives: serve the couple, not the vendor.

3. **AI contract review crosses the obvious ROI line at $149.** Couples sign vendor contracts without understanding cancellation policies, overtime charges, exclusivity clauses, or deposit-forfeiture terms. A lawyer charges $200–500/hr for this. AI doing it for free justifies the price on the first contract alone.

4. **Personalized timeline beats generic checklists.** "Book your florist 8 months out" is useless if you got engaged 6 months before your wedding. The AI knows your date, your booked vendors, and your city — it answers "are you behind?" with specifics, not articles.

5. **$149 one-time is psychologically ideal for a one-time event.** No subscription guilt. Couples planning $50K–$300K weddings don't balk at 0.1–0.3% of their budget for peace of mind. One-time pricing fits the psychology of a one-time event.

---

## Target Users

**Primary:** Newly engaged couples planning their own wedding without a full-service planner. Typically professional, 25–35, comfortable with web apps, planning a wedding 12–24 months out. Budget range $30K–$300K. US-focused at launch.

**Secondary (future):** Partial planners (day-of coordinators) who want to give clients a self-service hub. Not building for this in v1.

---

## Competitive Landscape

| Product | Model | AI Features | Gap |
|---|---|---|---|
| The Knot | Free, vendor marketplace | Visual vendor discovery (Sep 2025) | Vendor-biased, no contract review, no financial tracking |
| Zola | Free, registry-first | Task splitting, thank-you writer | No vendor discovery AI, no contract review |
| Joy | Free | RSVP AI, thank-you writer | No planning AI, no financial tracking |
| Aisle Planner | $20–100/yr | None | No AI, pro-facing UI |
| David's Bridal Pearl | Free | Natural language budgeting | Single retailer, no hub |

**White space:** No product combines neutral vendor discovery, AI contract review, personalized planning timeline, and financial tracking in a single hub at a consumer price point.

---

## Design System

### Visual Language
**Inspiration:** High-end hospitality (Aman Hotels, not Hilton). Luxury editorial (Vogue Weddings). The product should feel like a calm, capable advisor — not a wedding mood board.

### Color Tokens
```
--color-sidebar:        #2C1F14   /* espresso */
--color-bg:             #FDFBF7   /* warm cream */
--color-surface:        #FFFFFF   /* card backgrounds */
--color-border:         #E8E0D0   /* warm gray */
--color-text-primary:   #1A1208   /* near-black */
--color-text-secondary: #A0907A   /* warm gray */
--color-accent:         #C8A96E   /* gold */
--color-accent-hover:   #B8965E   /* gold dark */
--color-status-booked:  #4A7A5A   /* sage green */
--color-status-short:   #9A7840   /* amber */
--color-status-none:    #B0A090   /* muted */
--color-sidebar-text:   #8A7060   /* sidebar nav inactive */
--color-sidebar-active: #F5EFE6   /* sidebar nav active */
```

### Typography
```
--font-heading:  Georgia, 'Times New Roman', serif
--font-body:     -apple-system, 'Inter', 'Helvetica Neue', sans-serif
--font-label:    var(--font-body)  /* uppercase, tracked */
```

Usage:
- **Page titles, countdown numbers, vendor names, dollar amounts:** Georgia serif
- **Labels, nav items, badges, body copy, form inputs:** system sans-serif
- **Section labels:** uppercase, 0.12–0.15em letter-spacing, `--color-text-secondary`

### Layout
- **Sidebar:** 148px fixed width, `--color-sidebar` background, full-height
- **Main content:** fluid, `--color-bg`, padding 24px
- **Cards:** white surface, 1px `--color-border` border, no drop shadow (use border only)
- **Status badges:** inline, small caps style — no pill shapes with bright colors

### AI Advisor Card (Sidebar)
A persistent card at the bottom of the sidebar showing the most recent AI insight. Gold border, italic Georgia type, dark background. Updates when the user adds data or requests a timeline check.

```
┌─────────────────────────┐
│ AI ADVISOR              │  ← 9px uppercase, gold
│                         │
│ "You're on track. Book  │  ← 11px Georgia italic
│  your florist in the    │
│  next 3 weeks."         │
└─────────────────────────┘
```

---

## Architecture

### Frontend
- **React + Vite + TypeScript** — SPA with client-side routing (React Router)
- **Tailwind CSS** for layout/spacing, custom CSS variables for the design system
- **Deployed on Vercel** — automatic preview deploys on PRs

### Backend
- **Supabase** — Postgres database, Row Level Security (couples only see their own data), Auth (email/password + magic link), Storage (contract/proposal file uploads up to 25MB)
- **Supabase Edge Functions** — server-side Claude API and Google Places API calls (never expose API keys to client)
- No separate API server needed for CRUD

### AI
- **Claude API** (claude-sonnet-4-5) via Supabase Edge Functions
- All AI calls are async — UI shows loading state, streams result in
- Three AI surfaces at launch: planning timeline, vendor shortlist, contract review
- Vibe Profile is passed as context in every AI call
- **Vendor shortlist flow:** Google Places Text Search fetches current businesses by category + city → results passed to Claude with vibe profile → Claude ranks, filters, and adds reasoning per vendor

### Payments
- **Stripe Checkout** — one-time $149 purchase
- `allow_promotion_codes: true` on every checkout session (enables discount codes)
- Stripe webhook → Supabase sets `users.paid = true`
- Promo codes created in Stripe Dashboard (no code required per code)

### File Storage
- Contracts and proposals stored in Supabase Storage, `contracts/` bucket
- Files namespaced by couple ID: `contracts/{couple_id}/{vendor_id}/{filename}`
- Signed URLs for secure access (never public URLs)

---

## Data Model

### `couples`
```sql
id            uuid primary key
created_at    timestamptz
email_primary text unique
email_partner text
wedding_date  date
venue_name    text
city          text
state         text
budget_total  numeric
paid          boolean default false
stripe_session_id text
vibe_profile  jsonb   -- stores onboarding questionnaire answers
```

### `vendors`
```sql
id            uuid primary key
couple_id     uuid references couples
category      text   -- 'venue', 'band_dj', 'florist', etc.
name          text
status        text   -- 'not_started', 'shortlisted', 'booked'
contact_name  text
contact_email text
contact_phone text
website       text
notes         text
booked_amount numeric
created_at    timestamptz
```

### `payments`
```sql
id            uuid primary key
couple_id     uuid references couples
vendor_id     uuid references vendors
label         text   -- 'Deposit', 'Mid-Payment', 'Final Payment'
amount        numeric
due_date      date
paid_date     date
paid_by       text   -- 'couple', 'matt_family', 'hannah_family', or custom
notes         text
```

### `budget_categories`
```sql
id            uuid primary key
couple_id     uuid references couples
category      text
budgeted      numeric
-- booked and paid are computed from vendors + payments, not stored
```

### `contracts`
```sql
id            uuid primary key
couple_id     uuid references couples
vendor_id     uuid references vendors
file_path     text   -- Supabase Storage path
file_name     text
uploaded_at   timestamptz
ai_review     jsonb  -- { status, flags: [{clause, severity, text}], summary, reviewed_at }
```

### `ai_insights`
```sql
id            uuid primary key
couple_id     uuid references couples
type          text   -- 'timeline_check', 'vendor_shortlist', 'contract_review'
content       text
created_at    timestamptz
-- latest per type shown in sidebar AI card
```

---

## Core Features (v1 MVP)

### 1. Onboarding — Vibe Profile
**Entry point to the product.** After Stripe checkout, a 3-step onboarding flow.

- **Step 1 — The basics:** Wedding date, venue name (optional), city/state, total budget, partner names
- **Step 2 — Your vibe (6 structured inputs):**
  - Aesthetic: romantic / modern / rustic / industrial / maximalist / minimalist
  - Formality: black tie / cocktail / garden party / casual
  - Setting: urban venue / countryside / beach / ballroom / restaurant
  - Vibe words: pick 3 from a grid (moody, airy, classic, wild, intimate, grand, playful, timeless, bold, soft)
  - Music style: live band / DJ / acoustic / classical / mixed
  - Priority: what matters most — food, photography, flowers, music, decor
- **Step 3 — Quick start:** AI pre-populates a planning timeline based on date + budget. User lands on a dashboard with real content.

Vibe profile stored as JSON on the `couples` record. Passed as context to every subsequent AI call.

### 2. Dashboard (Home)
- Countdown to wedding date (Georgia serif, large)
- Budget summary widget (total / committed / paid)
- Vendor status overview (all 14 categories, status badges)
- Upcoming payments (next 3, with dates and amounts)
- AI Advisor sidebar card (latest insight)
- "Check my timeline" button → triggers AI timeline check

### 3. Vendor Tracker
- 14 default categories: Venue, Band/DJ, Florist, Photographer, Videographer, Caterer, Hair & Makeup, Cake & Desserts, Transportation, Invitations & Stationery, Rehearsal Dinner, Wedding Planner, Hotels, Lighting
- Each vendor card: name, status, contact info, booked amount, notes, contract upload
- Status flow: Not Started → Shortlisted → Booked
- **AI Shortlist button:** for any "Not Started" category, Claude returns 4–6 vendors in the couple's city ranked against their vibe profile, with one-line reasoning per vendor. Results shown inline, not in a separate modal.
- Custom categories allowed (+ Add Category)

### 4. Budget Tracker
- Per-category view: Budgeted / Booked / Paid / Remaining
- Booked total auto-syncs from vendor `booked_amount`
- Paid total auto-syncs from `payments` where `paid_date` is set
- Budget warning at 90% and 100% committed
- Category budgets editable inline

### 5. Finances & Payments
- **Upcoming payments list:** all future `due_date` entries sorted by date, with vendor name, payment label, amount
- **Payment calendar:** month view, payments shown as dots on due dates
- **By Family:** payments grouped by `paid_by` — shows each payer's total contribution and itemized list. Supports custom payer names (Matt's Family, Hannah's Family, etc.)
- Mark payment as paid inline (sets `paid_date` to today)

### 6. AI Planning Timeline
Triggered by "Check my timeline" on dashboard, or from the To-Do page.

Claude receives:
- Wedding date (and how many days out)
- City/state
- Each vendor category + current status
- Vibe profile
- Budget committed %

Returns a structured response:
- **Overall status:** On Track / At Risk / Behind
- **Urgent items (next 4 weeks):** specific vendors/tasks to act on now, with reasoning
- **On track:** what's already handled
- **Watch list:** things that aren't urgent yet but will be soon

Result stored in `ai_insights` and shown in the sidebar AI card. Refreshed on demand (not automatically — user clicks "Refresh").

### 7. AI Contract Review
Triggered when a contract PDF is uploaded to a vendor card.

Claude receives:
- Contract text (extracted from PDF via edge function)
- Vendor category
- Booked amount from vendor card

Returns structured flags:
- **Cancellation policy** — what happens if you cancel and when
- **Overtime charges** — cost per hour if event runs long
- **Exclusivity clauses** — restrictions on other vendors (e.g., "exclusive caterer required")
- **Deposit forfeiture** — conditions under which deposits are lost
- **Force majeure / rescheduling** — what happens if your venue cancels
- **Overall summary** — 2–3 sentences plain English

Flags have severity: `info` / `caution` / `flag`. Shown inline on the vendor card with expandable detail. Stored in `contracts.ai_review`.

### 8. Multi-User (Partner Access)
- Primary user invites partner by email
- Partner gets magic-link login, lands on same couple's dashboard
- Both partners have full read/write access
- No role distinction in v1 (both are equal)

### 9. Stripe Checkout
- Paywall after onboarding step 1 (date/basics collected, vibe locked behind payment)
- Checkout session with `allow_promotion_codes: true`
- On success: webhook sets `paid = true`, user redirected to vibe profile step
- On cancel: user returned to paywall page
- Promo codes managed entirely in Stripe Dashboard

---

## User Flows

### New user flow
```
Landing page
  → Sign up (email + password)
  → Onboarding Step 1 (date, city, budget, names)
  → Stripe Checkout ($149, promo code field)
  → Onboarding Step 2 (vibe profile)
  → Onboarding Step 3 (AI generates planning timeline)
  → Dashboard
```

### Returning user flow
```
Login
  → Dashboard (AI Advisor card shows latest insight)
```

### Vendor shortlist flow
```
Vendors page
  → Click category with "Not Started" status
  → Click "Get AI Shortlist"
  → Loading state (2–4 seconds)
  → 4–6 vendor suggestions appear inline with reasoning
  → Click vendor → pre-fills vendor card
  → Set status to Shortlisted or Booked
```

### Contract review flow
```
Vendor card (status: Booked)
  → Upload contract (PDF drag-drop or file picker)
  → Processing state ("Reviewing contract...")
  → AI review card appears on vendor page
  → Flags shown with severity badges
  → Each flag expandable for full clause text + explanation
```

---

## Error Handling

- **AI calls fail:** Show "Couldn't generate suggestions — try again" with retry button. Never block the UI. All AI features are enhancements, not gatekeepers.
- **PDF extraction fails:** "We couldn't read this file. Make sure it's a text-based PDF (not a scan). Try copying the contract text and pasting it instead." Offer a text-paste fallback for contract review.
- **Stripe webhook missed:** Poll `paid` status on app load for 30 seconds post-checkout. If still false after 30s, show "Payment processing — refresh in a minute" message.
- **File upload too large:** 25MB limit with clear error message before upload begins (check file size client-side).
- **Supabase auth session expired:** Silent token refresh. If refresh fails, redirect to login with "Your session expired — please sign in again."

---

## Testing Approach

- **Unit tests:** Data transformation functions (budget rollup calculations, payment sorting, vibe profile serialization). Vitest.
- **Integration tests:** Supabase CRUD operations against a local Supabase instance. Key paths: create couple, create vendor, upload contract, mark payment paid.
- **AI output tests:** Run contract review and timeline check prompts against a set of fixture contracts/profiles. Assert that flags are present for known red-flag clauses. Not strict equality — use keyword matching on severity/category.
- **E2E tests (Playwright):** Full user flow — sign up, onboarding, add vendor, request shortlist, upload contract, check timeline. Run against a staging environment with a Stripe test mode.
- **Manual QA:** Each release, run through the full happy path on a real browser with a real test Stripe card.

---

## Out of Scope (v1.1+)

- **Inspiration boards** — per-category image/link moodboards, connected to vibe profile. AI re-reads boards to refine vendor recommendations.
- **Vendor proposal comparison** — upload 2–3 proposals for the same category, Claude compares them side-by-side with a recommendation.
- **Guest list + RSVP** — guest management, dietary restrictions, RSVP tracking
- **Day-of timeline** — run-of-show builder for the wedding day itself
- **Communication log** — track emails/calls with each vendor
- **Mobile app** — React Native or native iOS. Web is mobile-responsive at launch.
- **Wedding planner mode** — B2B: planners manage multiple couples, share the hub with clients as a white-label tool.

---

## Open Questions

- ~~App name~~ **Decided:** Veil (`veil.ai`)
- ~~Analytics~~ **Decided:** Posthog (event tracking to understand AI feature usage)
- ~~AI vendor data source~~ **Decided:** Use Google Places API (Text Search) to fetch current, operating vendors by category + city before each Claude shortlist call. Claude handles vibe-matching and ranking; Google handles current reality. Cost ~$0.032/search, ~$0.45/user across all 14 categories. Integrated in v1, not deferred.
