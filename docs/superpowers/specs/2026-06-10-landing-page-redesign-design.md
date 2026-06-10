# Veil Landing Page Redesign — Design Spec

**Date:** 2026-06-10
**Target:** `~/veil-landing/index.html` (single static file, Vercel project `veil-landing`, marketing site for app.getwed.ai)
**Approved by user:** direction, hero treatment, and page flow approved via visual companion session.

## Goal

Replace the current landing page with a modern, awards-caliber experience in the existing "Elevated Warm Editorial" brand: cream/champagne palette, large serif typography, GSAP scroll choreography, and a three.js silk-shader hero. Desktop gets the full cinematic experience; mobile gets a fast, lightweight fallback.

## Constraints

- **Single static `index.html`** — no build step. GSAP, ScrollTrigger, three.js, and Lenis loaded from CDN with graceful degradation if any fail to load.
- **Brand:** keep Veil's warm editorial identity. Palette: cream `#FAF7F2`, warm cream `#F3EDE4`, deep cream `#EDE6DA`, charcoal `#2C2420`, charcoal-light `#5C524A`, champagne `#C9A96E` / light `#D4BA85` / dark `#B8944F`, sage `#8B9E7E`, terracotta `#C17A5A`. Fonts: Playfair Display (display serif) + DM Sans (body). Reuse the existing noise-texture overlay.
- **CTAs:** all primary CTAs link to `https://app.getwed.ai/signup`; "Log in" links to `https://app.getwed.ai/login`. Price is $149 one-time; "No subscriptions" messaging is a core differentiator and must stay prominent.
- **Accessibility:** `prefers-reduced-motion: reduce` disables the shader, pinning, parallax, and all non-essential animation — content must be fully readable with motion off. Semantic HTML, focus-visible styles, alt text, sufficient contrast.
- **Mobile (≤768px):** no three.js, no pinned sections, no scroll-scrubbed 3D. Static silk-gradient hero, simple fade/slide reveals, stacked layouts. Page must scroll smoothly on mid-range phones.
- **Assets:** reuse `app-screenshot.png` (the only existing asset). No licensed photography required by this design.

## Page Structure (top to bottom)

### 1. Nav
Fixed, blur-glass over cream. Logo (Playfair "Veil" + champagne heart icon), links: Features, Story, Pricing, Log in; charcoal pill CTA "Get Started". Hides on scroll-down, returns on scroll-up (GSAP). Mobile: logo + Log in + CTA only.

### 2. Hero — "Silk + Product Rise"
- Full-viewport. three.js `<canvas>` absolutely positioned behind content: soft champagne silk ribbons (plane geometry displaced by simplex noise in a vertex shader, fragment shader blends champagne tones over cream; additive softness, slow drift). Ribbons subtly bend toward cursor (eased mouse uniform). DPR capped at 2, geometry sized for 60fps.
- Content: kicker label ("VEIL — AI WEDDING PLANNER"), headline "Plan your wedding / *without the chaos*" in clamp(48px→92px) Playfair, line-by-line clip-mask reveal on load; sub-line; primary CTA pill + secondary "See how it works"; note "One-time purchase. No subscriptions. Yours forever."
- Product rise: the app screenshot (in a browser-chrome frame) sits at the bottom viewport edge, tilted back ~24° in 3D perspective, partially cut off. A scrubbed ScrollTrigger straightens it to 0°, scales it toward full content width, and settles it into section 3's space. Shadow/glow deepen as it lands.
- Mobile fallback: static CSS silk-gradient background (no canvas), headline fades up, screenshot shown flat with a simple reveal.

### 3. Proof strip
Thin editorial strip between hairlines: 14 vendor categories · AI personalized timeline · $0/mo no subscriptions · 1 place for everything. Hairline borders draw in; numbers count up once in view.

### 4. Pinned product story (replaces features grid) — centerpiece
- Desktop: section pins for ~4 viewport-heights. Left column: chapter index (01–04) + heading + paragraph that swap per step. Right column: the app UI vignette crossfades/zooms to match the active chapter.
- Chapters: ① Smart vendor matching ② A timeline that thinks ahead ③ AI contract review ④ Budget & payment tracking. Copy rewritten for each (2–3 sentences, concrete and benefit-led).
- Vignettes: stylized HTML/CSS recreations of each app surface (not screenshots) so they stay crisp and animate internally (e.g., vendor cards stagger in, timeline checkmarks draw, contract flags pulse, budget bars fill).
- Progress rail on the left edge showing chapter position.
- Mobile: unpinned — four stacked cards, each with its vignette above text, simple reveals.

### 5. How it works
Three steps with oversized Playfair numerals (01/02/03) in champagne, connecting hairline draws across, steps cascade in. Copy kept from current page (Tell us your date / Add what you have / Let AI guide you).

### 6. Testimonials — editorial pull-quotes
One oversized italic Playfair quote at a time (clamp 24px→40px), centered, with attribution in letterspaced caps. Auto-advances every ~6s with a word-stagger reveal; gold progress dashes are clickable. Pauses on hover/focus and when off-screen. The three existing quotes (Sarah M., Jessica T., Rachel & Dan) are kept. Reduced-motion: no auto-advance — the first quote shows statically and the dashes remain clickable with an instant swap.

### 7. Pricing
Kept structurally from the current page: single centered card, $149 one-time, "Best value" sage badge, 5 checked features, gold shimmer top border, charcoal pill CTA. Checklist staggers in.

### 8. Final CTA — dark inversion
Charcoal `#231D18` section: "Your wedding deserves better than a *spreadsheet.*" with gold underline that draws in, sub-line, cream CTA pill. Faint static silk reprise (CSS gradient, no WebGL). Footer below: brand, Product/Company/Legal columns, copyright — same links as current.

## Motion System

- **Libraries:** GSAP 3 + ScrollTrigger (CDN), Lenis smooth scroll (desktop only), three.js (hero only, desktop only).
- **Reveal grammar:** consistent vocabulary — headlines use line clip-mask reveals; body/UI use 24–32px fade-ups with `power3.out`; hairlines scale-in from left; numbers count up. Stagger 60–120ms.
- **Degradation ladder:** (1) reduced-motion → everything static/instant, shader off; (2) mobile → no three.js/Lenis/pinning, basic reveals only; (3) CDN failure → page fully readable with CSS-only styling (content never depends on JS).
- **Performance budget:** hero canvas ≤ ~64×64 plane segments, DPR ≤ 2, shader paused when hero off-screen or tab hidden; all scroll animation via transforms/opacity only (no layout thrash); total JS from CDN ≈ 200KB gzipped; `app-screenshot.png` lazy-decoded.

## Copy

Rewrite freely where the new structure needs it (hero sub, chapter copy, section kickers), preserving: the headline "Plan your wedding without the chaos", the $149/no-subscriptions positioning, the three testimonials, and the pricing feature list. Tone: confident, warm, concrete — never corporate.

## Out of Scope

- No changes to the app (`wedding-planner` repo) or its auth/signup flow.
- No new photography or illustration assets.
- No CMS, analytics, or A/B tooling changes.
- No additional pages (privacy/terms remain placeholder links).

## Verification

1. Desktop Chrome: full experience — shader, product rise, pinned story, smooth scroll.
2. Chrome DevTools mobile emulation (375×812 and 390×844): fallback active, no horizontal overflow, tap targets ≥ 44px, fast scroll.
3. `prefers-reduced-motion` emulation: no animation, all content visible.
4. Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95.
5. Deploy to Vercel `veil-landing` and re-verify live.
