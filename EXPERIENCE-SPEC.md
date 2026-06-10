# Veil Experience Layer Spec
## Making the product feel alive, personal, and worth $149

---

## The Problem

Right now, every page is designed around a "full data" state. When a couple opens the app for the first time, they see empty charts, rows of dashes, and blank containers. That's not a $149 experience. That's a spreadsheet template.

The product needs to answer three questions on every page, at every stage:
1. **Where am I?** (in the planning process)
2. **What should I do next?** (specific, actionable, prioritized)
3. **How am I doing?** (progress, health, confidence)

---

## 1. HOME PAGE REDESIGN

The Home page should NOT be a stats dashboard. It should be a personalized daily briefing that changes based on where the couple is in planning.

### 1a. Header Section
Keep "Marco & Sarah" and "325 days to go." But add a one-line contextual status beneath it:
- **Early planning (12+ months out):** "You're in great shape. Focus on locking in your top vendors this month."
- **Mid planning (6-12 months out):** "You're in the booking window. 8 of 14 vendor categories still need attention."
- **Late planning (3-6 months out):** "Final stretch. Time to confirm details and finalize your day-of timeline."
- **Final weeks:** "Almost there! Focus on confirmations and enjoy the moment."

This single line makes the home page feel personalized every time they open it.

### 1b. "This Week" Action Cards (replaces stat cards as the primary focus)
Instead of leading with budget/paid/vendors/tasks stat cards, lead with 2-3 action cards that tell the couple what to do RIGHT NOW. These are generated based on their wedding date, booked vendors, and planning progress.

Each card has:
- A clear action title (e.g., "Book a photographer")
- One line of context explaining why (e.g., "NYC photographers for April 2027 are booking now. You're at 10 months out.")
- A CTA button that takes them to the relevant page ("Find Photographers" or "Compare Proposals")
- A priority indicator (urgent = terracotta dot, important = gold dot, suggested = gray dot)

Example cards for Marco & Sarah at 10.5 months out:
- 🔴 **Book a photographer** — "Peak season NYC photographers book 12-18 months ahead. You're behind on this."  →  Find Photographers
- 🔴 **Confirm catering** — "Liberty Warehouse may have preferred caterers. Check your venue contract."  →  View Venue Details  
- 🟡 **Get band/DJ quotes** — "Quality live musicians for Saturday April weddings book 12+ months ahead."  →  Search Bands

These cards replace the AI Planning Advisor block. The advisor content becomes the logic that generates these cards. No more italic paragraph in a box. Instead, the intelligence is embedded in the UI itself.

### 1c. Stats Row (secondary, below action cards)
Move the 4 stat cards (Budget, Paid, Vendors, Tasks) below the action cards. They're still useful but they're not the first thing you see. Make them a compact single row with:
- Large number
- Small label
- Colored mini progress ring
- Click to navigate to the relevant page

### 1d. Budget + Payments Side-by-Side (keep this)
The donut chart and upcoming payments cards are good. Keep them.

### 1e. Vendor Status (redesign)
Instead of flat horizontal cards showing vendor name and status, show a compact visual:
- A horizontal segmented bar where each segment = a vendor category
- Filled segments = booked (sage green), outlined = in progress (gold), empty = not started (gray)
- Below the bar: only show vendors that need attention, not all of them. "3 categories need action" with the names listed.

### 1f. Partner Activity (new)
If both partners are using the tool, show a small "Recent Activity" section:
- "Sarah added 2 photographers to compare — 3 hours ago"
- "Marco uploaded the florist contract — yesterday"
This makes it feel collaborative and alive. If only one partner, hide this section.

### 1g. Kill "Invite your partner" after it's done
Once the partner is invited, remove this card. Don't show it forever.

---

## 2. EMPTY STATES ACROSS THE APP

Every page needs two designs: the "has data" state and the "empty" state. The empty state is MORE important because that's what new users see first.

### 2a. Budget Page (Empty)
**Current:** A table full of dashes and $0 across every row.

**Should be:** 
- Show a pre-filled suggested budget allocation based on their total budget, location, and guest count.
- Header: "Here's a typical budget breakdown for a $200K wedding in New York with ~150 guests"
- Pre-fill the "Budgeted" column with suggested amounts (Venue: $70K, Catering: $40K, Photography: $15K, etc.)
- Each row has an "Accept" or "Adjust" action
- A note: "These are starting points based on NYC averages. Adjust to match your priorities."
- The donut chart shows this suggested allocation so the page looks full and useful immediately

This transforms the budget page from "empty spreadsheet" to "smart recommendation you can customize."

### 2b. Vendors Page (Empty)
**Current:** 14 flat cards all saying "Get quotes."

**Should be:**
- Sort vendor categories by urgency based on wedding date: "Book these first" (venue, photographer, caterer) at the top, "Can wait" (transportation, hotels, lighting) at the bottom
- Add a small timeline indicator per category: "Typically booked 12+ months out" or "Book 3-6 months out"
- Highlight categories that are overdue based on their wedding date in terracotta
- The progress ring should show a suggested target: "You should have 4-5 vendors booked by now based on your date"

### 2c. Venue Page (Empty / Pre-booking)
**Current:** Only shows data after a venue is booked.

**Should be (before booking):**
- Show a venue comparison view: "Add venues you're considering"
- Quick-add cards for each venue being evaluated
- Comparison matrix that fills in as they add details (capacity, price, catering policy, etc.)
- Prompt: "Upload a venue brochure or proposal and we'll extract the details for you"

### 2d. Tasks Page (Empty)
**Current:** "Nothing due right now" with upcoming timeline items listed.

**Should be:**
- Show a progress summary: "1 of 6 planning phases complete"  
- The upcoming items should have more context: due date ranges, not just task names
- Add a "Your planning pace" indicator: "On track", "Slightly behind", or "Needs attention" based on where they are vs. where they should be
- Quick-add for custom tasks (they might have things not in the default timeline)

### 2e. Finances Page (Empty)
**Current:** A tiny progress bar and one payment floating in space.

**Should be:**
- Show a 12-month payment calendar view (even when mostly empty). Each month shows expected payments based on typical vendor payment schedules
- "Based on your wedding date, here's when major payments typically happen:" and show a visual timeline of Deposit → Mid-payment → Final payment cadence
- As they add vendors and contracts, this auto-populates with real dates
- When there's only 1-2 payments, fill the remaining space with "What to expect" context rather than whitespace

### 2f. Timeline Page (Empty — just started)
**Current:** Already decent with the phase-based checklist.

**Improve by:**
- Adding a visual progress bar at the top: "Phase 1 of 6 complete — 17% through your planning journey"
- Each phase header should show a date range, not just "By Jul 2026"
- Add estimated time per phase: "This phase typically takes 4-6 weeks"
- When a phase is complete, show a small celebration message: "Nice work! Venue, budget, and date are locked in."

---

## 3. PERSONALIZATION LAYER

The product already collects wedding date, location, budget, and guest count from onboarding. Use this data EVERYWHERE.

### 3a. Location-aware content
- Budget suggestions calibrated to their city (NYC vs. Austin vs. rural Virginia have wildly different cost structures)
- Vendor booking urgency adjusted by market competitiveness ("NYC is an extremely competitive wedding market" vs. "You have more time in your market")
- Seasonal adjustments ("April in New York is peak wedding season — vendors book early" vs. "January weddings have more vendor availability")

### 3b. Budget-aware nudges
- On the vendor pages: "Photographers in NYC for your budget range typically cost $5K-$12K"
- On the budget page: "You've allocated 43% to your venue. That's above the NYC average of 35%, which means other categories will be tighter. That's fine if the venue is your priority."
- When a proposal is uploaded: "This photographer quote of $8K is in the mid-range for NYC April weddings"

### 3c. Date-aware urgency
- Every vendor category should show how urgent it is based on their date
- The timeline should dynamically adjust: if they're 6 months out and haven't booked a photographer, that's a different urgency than if they're 14 months out
- Upcoming payment calculations based on typical vendor payment schedules relative to wedding date

### 3d. Progress-aware encouragement
- Track percentage of vendors booked, budget allocated, timeline completed
- Show progress comparisons: "Most couples at 10 months out have 3-4 vendors booked. You have 2. Let's get moving on photographer and caterer."
- This is NOT gamification. It's calibration. It helps couples understand if they're on track without needing a planner to tell them.

---

## 4. MILESTONE CELEBRATIONS

When key events happen, acknowledge them. This doesn't need to be confetti or over-the-top. Just warm, brief recognition.

### 4a. Trigger moments:
- **First vendor booked:** "Your venue is locked in! That's the biggest decision in wedding planning. Everything else builds from here."
- **50% of vendors booked:** "You're halfway there. 7 of 14 vendor categories are set."
- **All vendors booked:** "Every vendor is locked in. Time to shift focus to the details."
- **Budget fully allocated:** "Your budget is planned out. Keep an eye on the remaining balance as contracts finalize."
- **First contract uploaded:** "Smart move. We'll flag anything worth asking about."
- **Timeline phase completed:** "Phase 2 done. You're on track for an April 2027 wedding."
- **All payments marked as paid:** "Everything is paid up. One less thing to worry about."

### 4b. How they appear:
- A card that appears at the top of the Home page, above the action cards
- Warm background (soft gold tint), with a simple icon and 2 lines of text
- Dismissable (click X or "Got it")
- Only shows once per milestone

---

## 5. WEDDING HEALTH SCORE (Home Page)

Add a single "planning health" indicator to the Home page. This is the at-a-glance answer to "am I on track?"

### How it works:
Score is calculated from:
- Vendors booked vs. expected at this point in the timeline (weighted heavily)
- Budget allocated vs. total
- Timeline tasks completed vs. expected
- Payments made on time

### How it displays:
- A circular score indicator (not a number — use "On Track", "Needs Attention", "Behind") with a color (sage green, gold, terracotta)
- Lives in the right sidebar on the Home page, replacing or augmenting the countdown
- Clicking it expands to show which factors are contributing: "Vendors: behind (2 of expected 5 booked), Budget: on track, Payments: on track"

This gives the couple a single glance answer to "should I be worried?" without needing to check every page.

---

## 6. RIGHT SIDEBAR — FINAL CONTEXTUAL SPEC

### Home:
- Wedding health score (On Track / Needs Attention / Behind)
- Countdown with progress ring
- Quick actions: "Add Vendor", "Upload Contract", "View Timeline"

### Tasks:
- Planning pace indicator (On track / Behind)
- Current phase with progress bar
- Next 3 upcoming tasks with due dates

### Vendors:
- Vendor progress: X of 14 booked
- Categories that need attention (list only urgent ones)
- "Booking window" indicator for each urgent category

### Venue:
- Venue quick facts (capacity, location, catering policy) pulled from contract or manual entry
- Key contact info
- Important dates (site visit, tasting, final walkthrough)

### Budget:
- Budget health: over/under by category (show only categories with issues)
- Biggest remaining unallocated categories
- Next upcoming payment

### Finances:
- Payment calendar: next 60 days
- Paid vs. remaining as a simple bar
- Payments by family/source breakdown

### Timeline:
- Current phase with progress
- Phase completion estimates
- Next 3 tasks

### Settings:
- No sidebar. Give main content full width.

---

## Implementation Priority

**Phase 1 (do first — highest impact):**
1. Home page action cards replacing stat cards as primary focus
2. Budget page smart defaults / suggested allocation
3. Wedding health score in sidebar
4. Vendor page urgency sorting and timeline indicators

**Phase 2 (do next):**
5. Empty state redesigns for Finances and Venue pages
6. Milestone celebrations
7. Partner activity feed on Home page
8. Contextual right sidebar for all pages

**Phase 3 (polish):**
9. Location-aware budget suggestions
10. Date-aware vendor urgency across all pages
11. Progress-aware encouragement copy
12. Payment calendar visualization on Finances page

---

## How to use this spec

This is a product spec, not a design spec. It describes WHAT the product should do, not exactly how it should look. When implementing:

1. Read a section
2. Build the functionality
3. Follow CLAUDE.md for visual styling (colors, fonts, spacing, card styles)
4. Screenshot and send to me for design review

Start with Phase 1, item 1: the Home page action cards. That single change transforms the product from a dashboard into a planning companion.
