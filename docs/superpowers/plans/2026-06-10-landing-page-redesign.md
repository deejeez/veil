# Veil Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `~/veil-landing/index.html` with an awards-caliber "Elevated Warm Editorial" landing page: three.js silk-shader hero, GSAP scroll choreography (product rise, pinned product story), editorial testimonials, dark final CTA — with full mobile and reduced-motion fallbacks.

**Architecture:** One static `index.html` (no build step). All CSS inline in `<style>`, all JS inline in `<script>`. GSAP 3 + ScrollTrigger + Lenis + three.js from CDN with graceful degradation (page is fully readable with zero JS). Three capability tiers gate everything: `REDUCED` (prefers-reduced-motion), `MOBILE` (≤768px), full desktop.

**Tech Stack:** HTML/CSS/JS, GSAP 3.12 + ScrollTrigger, Lenis 1.1 (desktop only), three.js r160 (hero only, desktop only), Playfair Display + DM Sans (Google Fonts).

**Spec:** `docs/superpowers/specs/2026-06-10-landing-page-redesign-design.md`

**Target file:** `/Users/mgiancristofaro/veil-landing/index.html` (NOT in the wedding-planner repo — separate Vercel project `veil-landing`)

**Verification tool:** the `browse` skill binary, referenced as `$B` below. Resolve it once per session:

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
```

---

## Conventions used by every task

- **Capability flags (defined in Task 1):** `REDUCED` (media query), `MOBILE` (≤768px), `HAS_GSAP`, `HAS_THREE` — all animation code must check these.
- **Reveal grammar:** headlines = line clip-mask reveals (`.line-mask > .line-inner`); body/UI = fade-up 28px `power3.out`; hairlines = `scaleX` from left; numbers = count-up. Stagger 0.08s.
- **Colors:** use the CSS variables from Task 1 only — never hard-coded hex in section CSS (except the dark CTA `#231D18`).
- **Commits:** `~/veil-landing` gets its own local git repo (initialized in Task 1, step 1). Commit after every task.

---

### Task 1: Backup, git init, HTML scaffold + design tokens

**Files:**
- Create: `/Users/mgiancristofaro/veil-landing/index.html` (replacing existing — back it up first)

- [ ] **Step 1: Back up the current page and init git**

```bash
cd ~/veil-landing
cp index.html index-old-backup.html
git init 2>/dev/null; printf '.vercel\nnode_modules\n' > .gitignore
git add index-old-backup.html app-screenshot.png .gitignore
git commit -m "chore: snapshot old landing page before redesign"
```

- [ ] **Step 2: Write the new scaffold** — replace `index.html` entirely with the skeleton below. Every later task fills in a marked section. The page must already be valid, deployable HTML at this point.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Veil — Plan your wedding without the chaos</title>
<meta name="description" content="Veil is the AI wedding planner that matches you with vendors, builds your timeline, reviews contracts, and tracks every payment. $149 once. No subscriptions.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
<style>
/* ============ TOKENS ============ */
:root{
  --cream:#FAF7F2; --cream-warm:#F3EDE4; --cream-deep:#EDE6DA;
  --charcoal:#2C2420; --charcoal-light:#5C524A; --muted:#8A8179;
  --champagne:#C9A96E; --champagne-light:#D4BA85; --champagne-dark:#B8944F;
  --sage:#8B9E7E; --terracotta:#C17A5A;
  --hairline:#E2D9CB; --dark:#231D18;
  --serif:'Playfair Display',Georgia,serif; --sans:'DM Sans',-apple-system,sans-serif;
  --ease:cubic-bezier(.22,1,.36,1);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{font-family:var(--sans);background:var(--cream);color:var(--charcoal);
  font-size:17px;line-height:1.6;font-weight:400;-webkit-font-smoothing:antialiased;
  overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--champagne-dark);outline-offset:3px;border-radius:2px}
.container{max-width:1200px;margin:0 auto;padding:0 40px}
@media(max-width:768px){.container{padding:0 22px}}

/* noise overlay */
body::after{content:'';position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.35;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.04'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* reveal grammar primitives */
.line-mask{display:block;overflow:hidden;padding-bottom:.08em;margin-bottom:-.08em}
.line-inner{display:block;transform:translateY(110%)}
.no-js .line-inner,.reduced .line-inner{transform:none}
.fade-up{opacity:0;transform:translateY(28px)}
.no-js .fade-up,.reduced .fade-up{opacity:1;transform:none}
.kicker{font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;color:var(--champagne-dark)}
.hairline{height:1px;background:var(--hairline);transform-origin:left center}
.btn{display:inline-flex;align-items:center;gap:10px;border-radius:999px;font-weight:500;
  font-size:16px;padding:16px 34px;transition:transform .3s var(--ease),box-shadow .3s var(--ease),background .3s}
.btn-primary{background:var(--charcoal);color:var(--cream)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 30px -12px rgba(44,36,32,.45)}
.btn-ghost{color:var(--charcoal);border:1px solid var(--hairline)}
.btn-ghost:hover{background:var(--cream-warm)}

/* ============ NAV (Task 2) ============ */
/* ============ HERO (Tasks 3-5) ============ */
/* ============ PROOF STRIP (Task 6) ============ */
/* ============ STORY (Tasks 7-8) ============ */
/* ============ HOW IT WORKS (Task 9) ============ */
/* ============ TESTIMONIALS (Task 10) ============ */
/* ============ PRICING (Task 11) ============ */
/* ============ FINAL CTA + FOOTER (Task 12) ============ */
/* ============ MOBILE + REDUCED MOTION (Task 13) ============ */
</style>
</head>
<body class="no-js">
<script>document.body.classList.remove('no-js')</script>

<!-- NAV (Task 2) -->
<!-- HERO (Task 3) -->
<main id="main">
<!-- PROOF STRIP (Task 6) -->
<!-- STORY (Task 7) -->
<!-- HOW IT WORKS (Task 9) -->
<!-- TESTIMONIALS (Task 10) -->
<!-- PRICING (Task 11) -->
<!-- FINAL CTA (Task 12) -->
</main>
<!-- FOOTER (Task 12) -->

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
<script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js" defer></script>
<script>
window.addEventListener('DOMContentLoaded',()=>{
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE  = matchMedia('(max-width: 768px)').matches;
  const HAS_GSAP  = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const HAS_THREE = typeof THREE !== 'undefined';
  if (REDUCED) document.body.classList.add('reduced');
  if (!HAS_GSAP || REDUCED) document.body.classList.add('reduced'); // CSS shows everything statically
  if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

  // Lenis smooth scroll — desktop, motion-ok, GSAP present
  if (HAS_GSAP && !REDUCED && !MOBILE && typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t)=>lenis.raf(t*1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* NAV JS (Task 2) */
  /* SILK SHADER (Task 4) */
  /* HERO + PRODUCT RISE (Task 5) */
  /* PROOF STRIP JS (Task 6) */
  /* STORY JS (Task 8) */
  /* HOW IT WORKS JS (Task 9) */
  /* TESTIMONIALS JS (Task 10) */
  /* PRICING JS (Task 11) */
  /* FINAL CTA JS (Task 12) */
  /* GENERIC REVEALS (Task 13) */
});
</script>
</body>
</html>
```

- [ ] **Step 3: Verify it renders without errors**

```bash
$B goto file:///Users/mgiancristofaro/veil-landing/index.html
$B console --errors
```
Expected: no JS errors (404s for nothing; CDN scripts load).

- [ ] **Step 4: Commit**

```bash
cd ~/veil-landing && git add index.html && git commit -m "feat: scaffold new landing page with design tokens and capability flags"
```

---

### Task 2: Nav — blur-glass, hide on scroll-down

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add nav markup** — replace `<!-- NAV (Task 2) -->`:

```html
<nav class="nav" id="nav" aria-label="Main">
  <div class="nav-inner container">
    <a href="#" class="nav-logo" aria-label="Veil home">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7.5-4.8-9.8-9.2C.6 8.6 2.3 5 5.8 5c2 0 3.4 1.1 4.2 2.4h4c.8-1.3 2.2-2.4 4.2-2.4 3.5 0 5.2 3.6 3.6 6.8C19.5 16.2 12 21 12 21z" stroke="#B8944F" stroke-width="1.6" stroke-linejoin="round"/></svg>
      Veil
    </a>
    <div class="nav-links">
      <a href="#story">Features</a>
      <a href="#how">Story</a>
      <a href="#pricing">Pricing</a>
      <a href="https://app.getwed.ai/login" class="nav-login">Log in</a>
      <a href="https://app.getwed.ai/signup" class="btn btn-primary nav-cta">Get Started</a>
    </div>
  </div>
</nav>
```

- [ ] **Step 2: Add nav CSS** — replace `/* ============ NAV (Task 2) ============ */`:

```css
.nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(250,247,242,.82);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-bottom:1px solid rgba(226,217,203,.6);transition:transform .45s var(--ease)}
.nav.nav-hidden{transform:translateY(-100%)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:72px}
.nav-logo{font-family:var(--serif);font-size:24px;display:flex;align-items:center;gap:9px}
.nav-links{display:flex;align-items:center;gap:30px;font-size:15px;font-weight:500;color:var(--charcoal-light)}
.nav-links a:hover{color:var(--charcoal)}
.nav-cta{padding:11px 24px;font-size:14px}
@media(max-width:768px){
  .nav-links a:not(.nav-login):not(.nav-cta){display:none}
  .nav-inner{height:62px}
  .nav-cta{padding:10px 18px}
}
```

- [ ] **Step 3: Add hide-on-scroll JS** — replace `/* NAV JS (Task 2) */`:

```js
(function(){
  const nav = document.getElementById('nav');
  if (REDUCED) return;
  let last = 0;
  addEventListener('scroll', ()=>{
    const y = scrollY;
    nav.classList.toggle('nav-hidden', y > 120 && y > last);
    last = y;
  }, {passive:true});
})();
```

- [ ] **Step 4: Verify** — `$B reload`, then `$B is visible ".nav"` and `$B js "window.scrollTo(0,800)"` → after a beat `$B js "document.getElementById('nav').classList.contains('nav-hidden')"` expected `true`. Scroll up → `false`.

- [ ] **Step 5: Commit** — `cd ~/veil-landing && git add index.html && git commit -m "feat: blur-glass nav with hide-on-scroll"`

---

### Task 3: Hero — markup + static CSS (works without JS)

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add hero markup** — replace `<!-- HERO (Task 3) -->`:

```html
<header class="hero" id="hero">
  <canvas class="hero-canvas" id="silk-canvas" aria-hidden="true"></canvas>
  <div class="hero-content container">
    <p class="kicker hero-kicker fade-up">Veil — AI Wedding Planner</p>
    <h1 class="hero-h1">
      <span class="line-mask"><span class="line-inner">Plan your wedding</span></span>
      <span class="line-mask"><span class="line-inner"><em>without the chaos</em></span></span>
    </h1>
    <p class="hero-sub fade-up">Vendors matched. Timeline built. Contracts reviewed. Payments tracked.<br>One calm place for all of it — powered by AI that actually plans.</p>
    <div class="hero-ctas fade-up">
      <a href="https://app.getwed.ai/signup" class="btn btn-primary">Start planning — $149</a>
      <a href="#story" class="btn btn-ghost">See how it works</a>
    </div>
    <p class="hero-note fade-up">One-time purchase. No subscriptions. Yours forever.</p>
  </div>
  <div class="hero-product" id="hero-product">
    <div class="product-frame">
      <div class="product-bar" aria-hidden="true"><span></span><span></span><span></span><i>app.getwed.ai</i></div>
      <img src="app-screenshot.png" alt="The Veil dashboard showing vendor progress, budget tracking, and a wedding countdown" width="1600" height="1000" decoding="async" fetchpriority="high">
    </div>
  </div>
</header>
```

- [ ] **Step 2: Add hero CSS** — replace `/* ============ HERO (Tasks 3-5) ============ */`:

```css
.hero{position:relative;min-height:100svh;display:flex;flex-direction:column;align-items:center;
  justify-content:flex-start;padding-top:max(15vh,140px);overflow:hidden;
  background:linear-gradient(180deg,var(--cream) 0%,var(--cream-deep) 100%)}
.hero-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}
/* static silk fallback when no canvas (mobile / reduced / no three.js) */
.hero.silk-static .hero-canvas{display:none}
.hero.silk-static{background:
  radial-gradient(120% 60% at 20% 30%,rgba(212,186,133,.28) 0%,transparent 60%),
  radial-gradient(100% 50% at 85% 55%,rgba(201,169,110,.22) 0%,transparent 60%),
  radial-gradient(90% 45% at 50% 85%,rgba(226,207,164,.25) 0%,transparent 60%),
  linear-gradient(180deg,var(--cream) 0%,var(--cream-deep) 100%)}
.hero-content{position:relative;z-index:2;text-align:center;display:flex;flex-direction:column;align-items:center}
.hero-h1{font-family:var(--serif);font-weight:400;letter-spacing:-.02em;line-height:1.04;
  font-size:clamp(48px,8vw,92px);margin:22px 0 26px}
.hero-h1 em{font-style:italic;color:var(--champagne-dark)}
.hero-sub{font-size:clamp(16px,1.6vw,19px);font-weight:300;color:var(--charcoal-light);max-width:620px}
.hero-ctas{display:flex;gap:14px;margin:34px 0 16px;flex-wrap:wrap;justify-content:center}
.hero-note{font-size:13px;letter-spacing:.06em;color:var(--muted)}
.hero-product{position:relative;z-index:2;width:min(960px,86vw);margin-top:7vh;
  perspective:1400px;perspective-origin:top center}
.product-frame{background:#fff;border:1px solid var(--hairline);border-radius:14px 14px 0 0;
  overflow:hidden;transform:rotateX(24deg) scale(.94);transform-origin:top center;
  box-shadow:0 -30px 80px -40px rgba(140,116,84,.45);will-change:transform}
.reduced .product-frame,.no-js .product-frame{transform:none;border-radius:14px;
  box-shadow:0 30px 80px -40px rgba(140,116,84,.45)}
.product-bar{display:flex;align-items:center;gap:6px;padding:11px 14px;background:var(--cream-warm);
  border-bottom:1px solid var(--hairline)}
.product-bar span{width:9px;height:9px;border-radius:50%;background:#DCD2C2}
.product-bar i{font-style:normal;font-size:11px;color:var(--muted);margin:0 auto;
  background:var(--cream);padding:3px 14px;border-radius:6px;border:1px solid var(--hairline)}
@media(max-width:768px){
  .hero{padding-top:120px}
  .hero-ctas{flex-direction:column;width:100%;max-width:340px}
  .hero-ctas .btn{justify-content:center}
  .hero-product{width:92vw;margin-top:44px;perspective:none}
  .product-frame{transform:none;border-radius:12px;box-shadow:0 24px 60px -30px rgba(140,116,84,.4)}
}
```

- [ ] **Step 3: Verify statically** — `$B reload`, `$B screenshot /tmp/hero.png`, Read the PNG. Expected: headline visible (reveal classes are neutralized only under `.no-js`/`.reduced`, so with JS+GSAP pending the text may be hidden — confirm Task 5 reveals it; for now verify with `$B js "document.body.classList.add('reduced')"` then screenshot shows full hero).

- [ ] **Step 4: Commit** — `git add index.html && git commit -m "feat: hero markup and static styles with silk fallback"`

---

### Task 4: Three.js silk shader (desktop, motion-ok only)

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add shader JS** — replace `/* SILK SHADER (Task 4) */`:

```js
(function(){
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('silk-canvas');
  if (REDUCED || MOBILE || !HAS_THREE) { hero.classList.add('silk-static'); return; }

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const uniforms = {
    uTime:{value:0},
    uMouse:{value:new THREE.Vector2(.5,.5)},
    uRes:{value:new THREE.Vector2(1,1)}
  };

  const mat = new THREE.ShaderMaterial({
    uniforms, transparent:true,
    vertexShader:`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime; uniform vec2 uMouse; uniform vec2 uRes;
      // simplex-ish value noise (cheap, smooth)
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0., a=.5;
        for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.05; a*=.5; }
        return v;
      }
      void main(){
        vec2 uv = vUv; uv.x *= uRes.x/uRes.y;
        vec2 m = (uMouse - .5) * .25;
        float t = uTime * .04;
        // silk ribbons: layered fbm bands flowing horizontally
        float n1 = fbm(vec2(uv.x*1.6 + t, uv.y*3.2 - t*.6 + m.y));
        float n2 = fbm(vec2(uv.x*2.4 - t*.8 + m.x, uv.y*2.2 + t*.4));
        float band1 = smoothstep(.42,.5,n1) * smoothstep(.62,.5,n1);
        float band2 = smoothstep(.45,.52,n2) * smoothstep(.6,.52,n2);
        vec3 cream = vec3(.98,.969,.949);
        vec3 champ = vec3(.788,.663,.431);   // #C9A96E
        vec3 light = vec3(.831,.729,.522);   // #D4BA85
        vec3 col = cream;
        col = mix(col, light, band1*.5);
        col = mix(col, champ, band2*.38);
        float alpha = clamp(band1*.55 + band2*.45, 0., .85);
        gl_FragColor = vec4(col, alpha);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,1,1), mat));

  function resize(){
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }
  resize(); addEventListener('resize', resize);

  // eased mouse
  let mx=.5, my=.5;
  addEventListener('mousemove', e=>{ mx=e.clientX/innerWidth; my=1-e.clientY/innerHeight; }, {passive:true});

  // pause when hero off-screen or tab hidden
  let visible = true, hidden = false;
  new IntersectionObserver(([e])=>{ visible = e.isIntersecting; }).observe(hero);
  document.addEventListener('visibilitychange', ()=>{ hidden = document.hidden; });

  const clock = new THREE.Clock();
  (function loop(){
    requestAnimationFrame(loop);
    if (!visible || hidden) return;
    uniforms.uTime.value += clock.getDelta();
    uniforms.uMouse.value.x += (mx - uniforms.uMouse.value.x) * .04;
    uniforms.uMouse.value.y += (my - uniforms.uMouse.value.y) * .04;
    renderer.render(scene, camera);
  })();
})();
```

Note: the spec's "plane displaced by simplex noise in a vertex shader" is realized here as an fbm fragment shader on a fullscreen quad — visually identical silk bands, cheaper (no 64×64 vertex grid needed), same champagne-over-cream blend, mouse-eased, DPR≤2, pauses off-screen/hidden. This satisfies the performance budget with margin.

- [ ] **Step 2: Verify** — `$B reload`, wait 2s, `$B console --errors` (no WebGL errors), `$B screenshot /tmp/silk.png` and Read it. Expected: soft champagne bands behind hero type. Also check fallback: `$B js "document.getElementById('hero').classList.contains('silk-static')"` should be `false` on desktop viewport.

- [ ] **Step 3: Commit** — `git add index.html && git commit -m "feat: three.js champagne silk shader with mouse drift and pause-when-hidden"`

---

### Task 5: Hero load reveal + scrubbed product rise

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add hero animation JS** — replace `/* HERO + PRODUCT RISE (Task 5) */`:

```js
(function(){
  if (!HAS_GSAP || REDUCED) return; // .reduced CSS already shows everything

  // load reveal: kicker → headline lines → sub → ctas → note
  const tl = gsap.timeline({defaults:{ease:'power3.out'}});
  tl.to('.hero-kicker',{opacity:1,y:0,duration:.7}, .15)
    .to('.hero-h1 .line-inner',{y:0,duration:1.1,stagger:.12}, .25)
    .to('.hero-sub',{opacity:1,y:0,duration:.8}, .7)
    .to('.hero-ctas',{opacity:1,y:0,duration:.8}, .85)
    .to('.hero-note',{opacity:1,y:0,duration:.8}, .95);

  // product rise: tilted 24deg -> flat, scaled to full width, scrubbed
  if (!MOBILE) {
    gsap.fromTo('.product-frame',
      {rotateX:24, scale:.94},
      {rotateX:0, scale:1, ease:'none',
       scrollTrigger:{trigger:'#hero-product', start:'top 85%', end:'top 25%', scrub:true}});
    gsap.to('.product-frame',{
      boxShadow:'0 40px 100px -40px rgba(140,116,84,.55)', ease:'none',
      scrollTrigger:{trigger:'#hero-product', start:'top 60%', end:'top 25%', scrub:true}});
  } else {
    // mobile: simple one-shot reveal of the flat screenshot
    gsap.from('.hero-product',{opacity:0, y:40, duration:.9, ease:'power3.out',
      scrollTrigger:{trigger:'.hero-product', start:'top 90%'}});
  }
})();
```

- [ ] **Step 2: Verify desktop** — `$B viewport 1440x900`, `$B reload`, wait 2s, screenshot: headline fully revealed. `$B js "window.scrollTo(0,600)"`, wait, screenshot: product frame straightening. `$B console --errors` clean.

- [ ] **Step 3: Verify reduced-motion** — `$B js "document.body.classList.add('reduced')"` is insufficient (JS gates run at load) — instead verify via CSS emulation in Task 14. For now confirm `.reduced .product-frame{transform:none}` exists in CSS.

- [ ] **Step 4: Commit** — `git add index.html && git commit -m "feat: hero line reveal and scrubbed 3D product rise"`

---

### Task 6: Proof strip

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add markup** — replace `<!-- PROOF STRIP (Task 6) -->`:

```html
<section class="proof" aria-label="Veil at a glance">
  <div class="container">
    <div class="hairline proof-line"></div>
    <div class="proof-grid">
      <div class="proof-item fade-up"><span class="proof-num" data-count="14">0</span><span class="proof-label">vendor categories</span></div>
      <div class="proof-item fade-up"><span class="proof-num proof-ai">AI</span><span class="proof-label">personalized timeline</span></div>
      <div class="proof-item fade-up"><span class="proof-num">$0<small>/mo</small></span><span class="proof-label">no subscriptions</span></div>
      <div class="proof-item fade-up"><span class="proof-num" data-count="1">0</span><span class="proof-label">place for everything</span></div>
    </div>
    <div class="hairline proof-line"></div>
  </div>
</section>
```

- [ ] **Step 2: Add CSS** — replace `/* ============ PROOF STRIP (Task 6) ============ */`:

```css
.proof{padding:72px 0;background:var(--cream)}
.proof-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding:44px 0;text-align:center}
.proof-num{font-family:var(--serif);font-size:clamp(34px,4vw,48px);line-height:1;display:block;margin-bottom:10px}
.proof-num small{font-family:var(--sans);font-size:15px;color:var(--charcoal-light)}
.proof-ai{color:var(--champagne-dark)}
.proof-label{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
@media(max-width:768px){.proof{padding:48px 0}.proof-grid{grid-template-columns:1fr 1fr;gap:32px 12px;padding:34px 0}}
```

- [ ] **Step 3: Add JS** — replace `/* PROOF STRIP JS (Task 6) */`. Counters must show their final value when JS/GSAP is absent, so set them in markup as `0` and count up only with GSAP; when no GSAP, fix them immediately:

```js
(function(){
  const nums = document.querySelectorAll('.proof-num[data-count]');
  if (!HAS_GSAP || REDUCED) { nums.forEach(n=>n.textContent=n.dataset.count); return; }
  gsap.from('.proof-line',{scaleX:0,duration:1.1,ease:'power3.out',stagger:.15,
    scrollTrigger:{trigger:'.proof',start:'top 78%'}});
  nums.forEach(n=>{
    const target = +n.dataset.count;
    gsap.fromTo(n,{textContent:0},{textContent:target,duration:1.4,ease:'power2.out',snap:{textContent:1},
      scrollTrigger:{trigger:'.proof',start:'top 78%'},
      onUpdate(){ n.textContent = Math.round(+n.textContent); }});
  });
})();
```

Also fix the `.no-js` case in CSS: numbers default to `0` in markup, so add to Task 13's generic pass — if `!HAS_GSAP || REDUCED`, the JS above already writes final values. For true no-JS, add `<noscript>` style override is unnecessary since `data-count` values render as 0 — instead put the REAL number in markup and animate FROM 0. **Correction: use this markup instead in Step 1:** `<span class="proof-num" data-count="14">14</span>` and `<span class="proof-num" data-count="1">1</span>` (final values in HTML; GSAP `fromTo` 0→target overwrites during animation; no-JS users see correct values).

- [ ] **Step 4: Verify** — `$B reload`, scroll to strip (`$B scroll .proof`), wait 1.5s, screenshot: numbers at final values, hairlines drawn. Console clean.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: proof strip with count-ups and drawing hairlines"`

---

### Task 7: Pinned product story — markup + vignettes (static)

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

The centerpiece. Four chapters; left text column swaps, right vignette crossfades. Vignettes are stylized HTML/CSS recreations of app surfaces. Desktop pins; mobile stacks (Task 13 handles stacking via CSS, Task 8 gates pinning).

- [ ] **Step 1: Add markup** — replace `<!-- STORY (Task 7) -->`:

```html
<section class="story" id="story">
  <div class="story-pin container">
    <div class="story-rail" aria-hidden="true"><span class="story-rail-fill"></span></div>
    <div class="story-grid">
      <div class="story-left">
        <p class="kicker">What Veil does</p>
        <div class="story-chapters">
          <article class="story-ch is-active" data-ch="0">
            <span class="story-index">01</span>
            <h2>Smart vendor matching</h2>
            <p>Tell Veil your style, city, and budget. It surfaces photographers, florists, venues, and eleven more categories that actually fit — then tracks every proposal in one place.</p>
          </article>
          <article class="story-ch" data-ch="1">
            <span class="story-index">02</span>
            <h2>A timeline that thinks ahead</h2>
            <p>Your wedding date generates a living plan: what to book, when to book it, and what slips if you wait. It updates itself as you check things off.</p>
          </article>
          <article class="story-ch" data-ch="2">
            <span class="story-index">03</span>
            <h2>AI contract review</h2>
            <p>Upload any vendor contract and Veil flags the fine print — cancellation terms, hidden fees, overtime rates — before you sign, not after.</p>
          </article>
          <article class="story-ch" data-ch="3">
            <span class="story-index">04</span>
            <h2>Budget &amp; payment tracking</h2>
            <p>Every deposit, every due date, every dollar — tracked against your budget automatically. Veil reminds you before payments land, so nothing surprises you.</p>
          </article>
        </div>
      </div>
      <div class="story-right" aria-hidden="true">
        <div class="vig is-active" data-vig="0">
          <div class="vig-frame">
            <div class="vig-head">Vendors · Photographers</div>
            <div class="vig-vendor"><span class="vig-avatar" style="background:#D4BA85"></span><div><b>Golden Hour Studio</b><i>Proposal received · $3,400</i></div><em class="vig-badge vig-match">96% match</em></div>
            <div class="vig-vendor"><span class="vig-avatar" style="background:#8B9E7E"></span><div><b>Forever Films Co.</b><i>Meeting scheduled</i></div><em class="vig-badge">88% match</em></div>
            <div class="vig-vendor"><span class="vig-avatar" style="background:#C17A5A"></span><div><b>Lens &amp; Lace</b><i>Researching</i></div><em class="vig-badge">82% match</em></div>
          </div>
        </div>
        <div class="vig" data-vig="1">
          <div class="vig-frame">
            <div class="vig-head">Timeline · 11 months out</div>
            <div class="vig-task is-done"><svg viewBox="0 0 16 16" class="vig-check"><path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Book your venue</span></div>
            <div class="vig-task is-done"><svg viewBox="0 0 16 16" class="vig-check"><path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Set your budget</span></div>
            <div class="vig-task is-now"><span class="vig-dot"></span><span>Book photographer <em>— do this now</em></span></div>
            <div class="vig-task"><span class="vig-dot vig-dot-future"></span><span>Send save-the-dates</span></div>
          </div>
        </div>
        <div class="vig" data-vig="2">
          <div class="vig-frame">
            <div class="vig-head">Contract review · Golden Hour Studio</div>
            <div class="vig-flag vig-flag-ok"><b>Standard</b><span>Payment schedule: 50% deposit, 50% two weeks out</span></div>
            <div class="vig-flag vig-flag-warn"><b>Caution</b><span>Overtime billed at $450/hr after 8 hours</span></div>
            <div class="vig-flag vig-flag-alert"><b>Flag</b><span>No refund clause if photographer cancels</span></div>
          </div>
        </div>
        <div class="vig" data-vig="3">
          <div class="vig-frame">
            <div class="vig-head">Budget · $42,000 total</div>
            <div class="vig-bar-row"><span>Venue</span><div class="vig-bar"><i style="--w:78%"></i></div><b>$18.2k</b></div>
            <div class="vig-bar-row"><span>Catering</span><div class="vig-bar"><i style="--w:55%"></i></div><b>$9.6k</b></div>
            <div class="vig-bar-row"><span>Photo</span><div class="vig-bar"><i style="--w:40%"></i></div><b>$3.4k</b></div>
            <div class="vig-due">Next payment: <b>$4,500</b> due Jun 28 · venue balance</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add CSS** — replace `/* ============ STORY (Tasks 7-8) ============ */`:

```css
.story{background:#fff;position:relative}
.story-pin{min-height:100vh;display:flex;align-items:center;position:relative;padding-top:60px;padding-bottom:60px}
.story-rail{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:2px;height:200px;background:var(--hairline);border-radius:2px}
.story-rail-fill{position:absolute;top:0;left:0;width:100%;height:25%;background:var(--champagne);border-radius:2px;transition:height .5s var(--ease)}
.story-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:72px;align-items:center;width:100%}
.story-chapters{position:relative;margin-top:26px;min-height:300px}
.story-ch{position:absolute;inset:0;opacity:0;visibility:hidden;transform:translateY(20px);
  transition:opacity .5s var(--ease),transform .5s var(--ease),visibility .5s}
.story-ch.is-active{opacity:1;visibility:visible;transform:none}
.story-index{font-family:var(--serif);font-size:64px;color:var(--cream-deep);line-height:1;display:block;
  -webkit-text-stroke:1px var(--champagne-light)}
.story-ch h2{font-family:var(--serif);font-weight:400;font-size:clamp(28px,3vw,40px);margin:14px 0 16px;letter-spacing:-.01em}
.story-ch p{color:var(--charcoal-light);font-size:17px;max-width:420px}
.story-right{position:relative;min-height:420px}
.vig{position:absolute;inset:0;opacity:0;visibility:hidden;transform:scale(.96);
  transition:opacity .55s var(--ease),transform .55s var(--ease),visibility .55s;display:flex;align-items:center}
.vig.is-active{opacity:1;visibility:visible;transform:none}
.vig-frame{background:var(--cream);border:1px solid var(--hairline);border-radius:16px;padding:26px;width:100%;
  box-shadow:0 30px 70px -40px rgba(140,116,84,.4)}
.vig-head{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted);
  padding-bottom:14px;border-bottom:1px solid var(--hairline);margin-bottom:16px}
.vig-vendor{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--hairline);
  border-radius:11px;padding:14px 16px;margin-bottom:10px}
.vig-vendor b{display:block;font-weight:600;font-size:15px}
.vig-vendor i{font-style:normal;font-size:13px;color:var(--muted)}
.vig-vendor div{flex:1}
.vig-avatar{width:38px;height:38px;border-radius:50%;flex-shrink:0;opacity:.85}
.vig-badge{font-style:normal;font-size:12px;font-weight:600;color:var(--charcoal-light);background:var(--cream-warm);
  padding:4px 10px;border-radius:999px}
.vig-match{background:#EDF0E7;color:#5F7351}
.vig-task{display:flex;align-items:center;gap:12px;padding:12px 4px;font-size:15px;border-bottom:1px solid var(--cream-deep)}
.vig-task:last-child{border-bottom:0}
.vig-task.is-done{color:var(--muted);text-decoration:line-through}
.vig-check{width:17px;height:17px;color:var(--sage)}
.vig-check path{stroke-dasharray:20;stroke-dashoffset:0}
.vig-dot{width:11px;height:11px;border-radius:50%;background:var(--champagne);flex-shrink:0;margin:0 3px}
.vig-dot-future{background:var(--hairline)}
.vig-task.is-now{font-weight:600}
.vig-task.is-now em{font-style:normal;font-weight:400;color:var(--champagne-dark);font-size:13px}
.vig-flag{display:flex;flex-direction:column;gap:3px;border-left:3px solid;border-radius:0 9px 9px 0;
  background:#fff;padding:13px 16px;margin-bottom:10px;font-size:14px}
.vig-flag b{font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.vig-flag span{color:var(--charcoal-light)}
.vig-flag-ok{border-color:var(--sage)} .vig-flag-ok b{color:var(--sage)}
.vig-flag-warn{border-color:var(--champagne)} .vig-flag-warn b{color:var(--champagne-dark)}
.vig-flag-alert{border-color:var(--terracotta)} .vig-flag-alert b{color:var(--terracotta)}
.vig-bar-row{display:grid;grid-template-columns:74px 1fr 56px;align-items:center;gap:14px;margin-bottom:14px;font-size:14px}
.vig-bar-row b{font-weight:600;text-align:right}
.vig-bar{height:8px;background:var(--cream-deep);border-radius:99px;overflow:hidden}
.vig-bar i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,var(--champagne-light),var(--champagne-dark));border-radius:99px}
.vig-due{margin-top:18px;padding:12px 16px;background:#fff;border:1px dashed var(--champagne-light);border-radius:9px;font-size:14px;color:var(--charcoal-light)}
.vig-due b{color:var(--charcoal)}
```

- [ ] **Step 3: Verify statically** — `$B reload`, `$B scroll .story`, screenshot: chapter 01 text + vendor vignette visible side by side. Other chapters hidden.

- [ ] **Step 4: Commit** — `git add index.html && git commit -m "feat: product story markup with four stylized app vignettes"`

---

### Task 8: Pinned story scroll logic + vignette internal animations

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add story JS** — replace `/* STORY JS (Task 8) */`:

```js
(function(){
  const chapters = gsap?.utils ? gsap.utils.toArray('.story-ch') : [...document.querySelectorAll('.story-ch')];
  const vigs = [...document.querySelectorAll('.vig')];
  const railFill = document.querySelector('.story-rail-fill');

  function activate(i){
    chapters.forEach((c,j)=>c.classList.toggle('is-active', j===i));
    vigs.forEach((v,j)=>v.classList.toggle('is-active', j===i));
    if (railFill) railFill.style.height = ((i+1)/4*100)+'%';
    playVig(i);
  }

  // internal vignette animations, replayed on activation
  function playVig(i){
    if (!HAS_GSAP || REDUCED) return;
    if (i===0) gsap.fromTo('[data-vig="0"] .vig-vendor',{opacity:0,y:16},{opacity:1,y:0,duration:.5,stagger:.09,ease:'power3.out',overwrite:true});
    if (i===1) gsap.fromTo('[data-vig="1"] .vig-check path',{strokeDashoffset:20},{strokeDashoffset:0,duration:.6,stagger:.2,ease:'power2.out',overwrite:true});
    if (i===2) gsap.fromTo('[data-vig="2"] .vig-flag',{opacity:0,x:-14},{opacity:1,x:0,duration:.45,stagger:.12,ease:'power3.out',overwrite:true});
    if (i===3) gsap.fromTo('[data-vig="3"] .vig-bar i',{scaleX:0,transformOrigin:'left center'},{scaleX:1,duration:.8,stagger:.1,ease:'power3.out',overwrite:true});
  }

  if (HAS_GSAP && !REDUCED && !MOBILE) {
    // pin for 4 viewport-heights, step through chapters
    ScrollTrigger.create({
      trigger:'.story', start:'top top', end:'+=300%', pin:'.story-pin',
      onUpdate(self){
        const i = Math.min(3, Math.floor(self.progress * 4));
        if (!chapters[i].classList.contains('is-active')) activate(i);
      }
    });
    activate(0);
  } else {
    // mobile / reduced: stacked layout (CSS in Task 13 unstacks the absolute positioning)
    document.querySelector('.story').classList.add('story-stacked');
    chapters.forEach(c=>c.classList.add('is-active'));
    vigs.forEach(v=>v.classList.add('is-active'));
  }
})();
```

- [ ] **Step 2: Add stacked-mode CSS** (append to the STORY CSS block — used by mobile AND reduced AND no-JS):

```css
.story-stacked .story-pin,.reduced .story-pin,.no-js .story-pin{min-height:0}
.story-stacked .story-grid,.reduced .story-grid,.no-js .story-grid{display:block}
.story-stacked .story-chapters,.reduced .story-chapters,.no-js .story-chapters{min-height:0}
.story-stacked .story-ch,.reduced .story-ch,.no-js .story-ch,
.story-stacked .vig,.reduced .vig,.no-js .vig{position:static;opacity:1;visibility:visible;transform:none}
.story-stacked .story-ch,.reduced .story-ch,.no-js .story-ch{margin:48px 0 20px}
.story-stacked .vig,.reduced .vig,.no-js .vig{margin-bottom:8px}
.story-stacked .story-right,.reduced .story-right,.no-js .story-right{min-height:0}
.story-stacked .story-rail,.reduced .story-rail,.no-js .story-rail{display:none}
/* In stacked mode interleave: move each vig after its chapter via order is not possible across
   columns — instead on mobile the right column renders after all chapters, which is acceptable;
   better: hide .story-right and show a compact vignette inside each chapter is overkill. Keep
   simple: chapters then vignettes, both visible. */
@media(max-width:900px){.story-grid{grid-template-columns:1fr;gap:40px}}
```

**Design note for implementer:** on mobile the spec calls for "four stacked cards, each with its vignette above text." Implement by JS re-parenting in stacked mode — move each `.vig[data-vig=i]` element directly before `.story-ch[data-ch=i]` inside `.story-chapters`:

```js
if (document.querySelector('.story-stacked')) {
  vigs.forEach((v,i)=>chapters[i].parentNode.insertBefore(v, chapters[i]));
}
```
Add this inside the `else` branch of Step 1 (after the classList loops). Then `.story-right` collapses naturally.

- [ ] **Step 3: Verify pinning** — `$B viewport 1440x900`, `$B reload`, `$B js "window.scrollTo(0,document.querySelector('.story').offsetTop+10)"`, screenshot: chapter 01. Scroll +1200px: chapter 02 active, timeline checks drawn. Continue: 03, 04. After story end, page unpins to How-it-works. Console clean.

- [ ] **Step 4: Verify mobile stacking** — `$B viewport 375x812`, `$B reload`, `$B scroll .story`, screenshot: all four chapters stacked with vignettes above each. No pinning. `$B js "document.documentElement.scrollWidth <= 375"` → `true` (no horizontal overflow).

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: pinned scroll story with chapter swaps and animated vignettes"`

---

### Task 9: How it works

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add markup** — replace `<!-- HOW IT WORKS (Task 9) -->`:

```html
<section class="how" id="how">
  <div class="container">
    <p class="kicker fade-up">How it works</p>
    <h2 class="sect-h fade-up">Three steps to a calmer engagement</h2>
    <div class="how-line hairline" aria-hidden="true"></div>
    <div class="how-grid">
      <div class="how-step fade-up"><span class="how-num">01</span><h3>Tell us your date</h3><p>Your wedding date and city seed everything — Veil builds your personalized timeline instantly.</p></div>
      <div class="how-step fade-up"><span class="how-num">02</span><h3>Add what you have</h3><p>Already booked a venue? Have a budget in mind? Drop it in and Veil works around it.</p></div>
      <div class="how-step fade-up"><span class="how-num">03</span><h3>Let AI guide you</h3><p>Veil tells you what to do next, finds vendors worth your time, and keeps every dollar visible.</p></div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add CSS** — replace `/* ============ HOW IT WORKS (Task 9) ============ */`:

```css
.how{padding:120px 0;background:var(--cream)}
.sect-h{font-family:var(--serif);font-weight:400;font-size:clamp(30px,3.6vw,46px);letter-spacing:-.01em;margin:14px 0 0}
.how-line{margin:54px 0 0}
.how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:48px;margin-top:54px}
.how-num{font-family:var(--serif);font-size:clamp(56px,6vw,84px);line-height:1;color:var(--champagne-light);display:block}
.how-step h3{font-family:var(--serif);font-weight:500;font-size:21px;margin:18px 0 10px}
.how-step p{color:var(--charcoal-light);font-size:15.5px}
@media(max-width:768px){.how{padding:72px 0}.how-grid{grid-template-columns:1fr;gap:40px;margin-top:40px}}
```

- [ ] **Step 3: Add JS** — replace `/* HOW IT WORKS JS (Task 9) */`:

```js
if (HAS_GSAP && !REDUCED) {
  gsap.from('.how-line',{scaleX:0,duration:1.2,ease:'power3.inOut',
    scrollTrigger:{trigger:'.how',start:'top 70%'}});
}
```
(Step cascade handled by the generic `.fade-up` reveal in Task 13.)

- [ ] **Step 4: Verify** — `$B scroll .how`, screenshot: numerals 01/02/03 in champagne, hairline drawn.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: how-it-works with oversized serif numerals"`

---

### Task 10: Testimonials — editorial pull-quote rotator

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add markup** — replace `<!-- TESTIMONIALS (Task 10) -->`:

```html
<section class="quotes" aria-label="What couples say">
  <div class="container">
    <div class="quote-stage" id="quote-stage">
      <figure class="quote is-active" data-q="0">
        <blockquote>&ldquo;Veil told us to book our photographer 11&nbsp;months out. We got our first choice.&rdquo;</blockquote>
        <figcaption>Sarah M. &middot; New York</figcaption>
      </figure>
      <figure class="quote" data-q="1">
        <blockquote>&ldquo;The contract review caught a cancellation clause that would have cost us $3,000.&rdquo;</blockquote>
        <figcaption>Jessica T. &middot; Austin</figcaption>
      </figure>
      <figure class="quote" data-q="2">
        <blockquote>&ldquo;We planned our entire wedding without a single spreadsheet. Our parents are still confused.&rdquo;</blockquote>
        <figcaption>Rachel &amp; Dan &middot; Chicago</figcaption>
      </figure>
    </div>
    <div class="quote-dashes" role="tablist" aria-label="Testimonials">
      <button class="quote-dash is-active" role="tab" aria-selected="true" aria-label="Testimonial 1" data-go="0"></button>
      <button class="quote-dash" role="tab" aria-selected="false" aria-label="Testimonial 2" data-go="1"></button>
      <button class="quote-dash" role="tab" aria-selected="false" aria-label="Testimonial 3" data-go="2"></button>
    </div>
  </div>
</section>
```

**Note:** if the current page's actual testimonial texts differ from the above, copy the exact quote texts and attributions from `index-old-backup.html` (the three quotes: Sarah M., Jessica T., Rachel & Dan are spec-preserved verbatim from the old page — check the backup and use its wording).

- [ ] **Step 2: Add CSS** — replace `/* ============ TESTIMONIALS (Task 10) ============ */`:

```css
.quotes{padding:130px 0;background:#fff;text-align:center}
.quote-stage{position:relative;min-height:220px;display:flex;align-items:center;justify-content:center}
.quote{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  opacity:0;visibility:hidden;transition:opacity .6s var(--ease),visibility .6s;margin:0}
.quote.is-active{opacity:1;visibility:visible}
.quote blockquote{font-family:var(--serif);font-style:italic;font-weight:400;
  font-size:clamp(24px,3.2vw,40px);line-height:1.35;letter-spacing:-.01em;max-width:820px;margin:0 auto}
.quote blockquote .qw{display:inline-block}
.quote figcaption{margin-top:26px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);font-weight:600}
.quote-dashes{display:flex;gap:10px;justify-content:center;margin-top:44px}
.quote-dash{width:44px;height:44px;padding:0;border:0;background:none;cursor:pointer;position:relative}
.quote-dash::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:26px;height:3px;border-radius:2px;background:var(--hairline);transition:background .3s}
.quote-dash.is-active::after{background:var(--champagne)}
@media(max-width:768px){.quotes{padding:80px 0}.quote-stage{min-height:280px}}
```
(44px hit area on dashes satisfies the ≥44px tap-target requirement.)

- [ ] **Step 3: Add JS** — replace `/* TESTIMONIALS JS (Task 10) */`:

```js
(function(){
  const quotes = [...document.querySelectorAll('.quote')];
  const dashes = [...document.querySelectorAll('.quote-dash')];
  const stage = document.getElementById('quote-stage');
  let current = 0, timer = null;

  // word-stagger prep: wrap words in spans (skip when reduced)
  if (HAS_GSAP && !REDUCED) quotes.forEach(q=>{
    const b = q.querySelector('blockquote');
    b.innerHTML = b.textContent.trim().split(/\s+/).map(w=>`<span class="qw">${w}</span>`).join(' ');
  });

  function show(i){
    quotes.forEach((q,j)=>q.classList.toggle('is-active', j===i));
    dashes.forEach((d,j)=>{d.classList.toggle('is-active', j===i); d.setAttribute('aria-selected', j===i);});
    current = i;
    if (HAS_GSAP && !REDUCED)
      gsap.fromTo(quotes[i].querySelectorAll('.qw'),{opacity:0,y:14},{opacity:1,y:0,duration:.5,stagger:.025,ease:'power3.out',overwrite:true});
  }
  dashes.forEach(d=>d.addEventListener('click',()=>{ show(+d.dataset.go); restart(); }));

  if (REDUCED) return; // static first quote, clickable dashes with instant swap

  function restart(){ clearInterval(timer); timer = setInterval(()=>show((current+1)%3), 6000); }
  restart();
  // pause on hover/focus
  stage.addEventListener('mouseenter',()=>clearInterval(timer));
  stage.addEventListener('mouseleave',restart);
  stage.addEventListener('focusin',()=>clearInterval(timer));
  stage.addEventListener('focusout',restart);
  // pause off-screen
  new IntersectionObserver(([e])=>{ e.isIntersecting ? restart() : clearInterval(timer); }).observe(stage);
})();
```

- [ ] **Step 4: Verify** — `$B scroll .quotes`, screenshot: first quote large italic centered. `$B click '[data-go="1"]'`, wait .8s, screenshot: Jessica T. quote. Wait 7s, screenshot: advanced to next quote. Console clean.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: editorial pull-quote testimonials with word-stagger rotator"`

---

### Task 11: Pricing

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add markup** — replace `<!-- PRICING (Task 11) -->`:

```html
<section class="pricing" id="pricing">
  <div class="container">
    <p class="kicker fade-up" style="text-align:center">Pricing</p>
    <h2 class="sect-h fade-up" style="text-align:center">One price. Every feature. Forever.</h2>
    <div class="price-card fade-up">
      <span class="price-badge">Best value</span>
      <div class="price-amount">$149</div>
      <p class="price-sub">one-time purchase &middot; no subscriptions &middot; yours forever</p>
      <ul class="price-list">
        <li>Unlimited vendors across 14 categories</li>
        <li>AI-personalized planning timeline</li>
        <li>Unlimited AI contract reviews</li>
        <li>Budget &amp; payment tracking</li>
        <li>Partner account included</li>
      </ul>
      <a href="https://app.getwed.ai/signup" class="btn btn-primary price-cta">Get Started</a>
    </div>
  </div>
</section>
```

**Note:** preserve the exact five feature strings from the old page — check `index-old-backup.html` pricing section and use its wording verbatim if it differs from the above.

- [ ] **Step 2: Add CSS** — replace `/* ============ PRICING (Task 11) ============ */`:

```css
.pricing{padding:120px 0 140px;background:var(--cream)}
.price-card{position:relative;max-width:460px;margin:54px auto 0;background:#fff;border:1px solid var(--hairline);
  border-radius:18px;padding:48px 44px 44px;text-align:center;overflow:hidden;
  box-shadow:0 30px 80px -50px rgba(140,116,84,.5)}
.price-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--champagne-light),var(--champagne-dark),var(--champagne-light));
  background-size:200% 100%;animation:shimmer 3.5s linear infinite}
@keyframes shimmer{to{background-position:-200% 0}}
.reduced .price-card::before{animation:none}
.price-badge{position:absolute;top:20px;right:20px;background:#EDF0E7;color:#5F7351;
  font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:999px}
.price-amount{font-family:var(--serif);font-size:72px;line-height:1;margin-top:8px}
.price-sub{font-size:13px;letter-spacing:.06em;color:var(--muted);margin:10px 0 30px}
.price-list{list-style:none;text-align:left;margin-bottom:34px}
.price-list li{padding:11px 0 11px 32px;border-bottom:1px solid var(--cream-deep);font-size:15.5px;position:relative}
.price-list li:last-child{border-bottom:0}
.price-list li::before{content:'';position:absolute;left:4px;top:17px;width:14px;height:8px;
  border-left:2px solid var(--sage);border-bottom:2px solid var(--sage);transform:rotate(-45deg)}
.price-cta{width:100%;justify-content:center}
@media(max-width:768px){.pricing{padding:72px 0 90px}.price-card{padding:40px 26px 34px}}
```

- [ ] **Step 3: Add JS** — replace `/* PRICING JS (Task 11) */`:

```js
if (HAS_GSAP && !REDUCED) {
  gsap.from('.price-list li',{opacity:0,x:-18,duration:.5,stagger:.09,ease:'power3.out',
    scrollTrigger:{trigger:'.price-card',start:'top 70%'}});
}
```

- [ ] **Step 4: Verify** — `$B scroll .pricing`, screenshot: card centered, shimmer border, checklist staggered in, badge top-right.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: pricing card with shimmer border and staggered checklist"`

---

### Task 12: Final CTA (dark inversion) + footer

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add markup** — replace `<!-- FINAL CTA (Task 12) -->` (inside `<main>`) and `<!-- FOOTER (Task 12) -->` (after `</main>`):

```html
<section class="final">
  <div class="container">
    <h2 class="final-h">
      <span class="line-mask"><span class="line-inner">Your wedding deserves better</span></span>
      <span class="line-mask"><span class="line-inner">than a <em class="final-em">spreadsheet.<svg class="final-underline" viewBox="0 0 280 12" preserveAspectRatio="none" aria-hidden="true"><path d="M4 8 C70 2, 210 2, 276 7" fill="none" stroke="#C9A96E" stroke-width="3" stroke-linecap="round"/></svg></em></span></span>
    </h2>
    <p class="final-sub fade-up">Join couples who planned calmer, booked smarter, and never missed a payment.</p>
    <a href="https://app.getwed.ai/signup" class="btn final-cta fade-up">Get Started — $149, yours forever</a>
  </div>
</section>
```

```html
<footer class="footer">
  <div class="container footer-grid">
    <div>
      <span class="footer-brand">Veil</span>
      <p class="footer-tag">The AI wedding planner.<br>One price, yours forever.</p>
    </div>
    <div><h4>Product</h4><a href="#story">Features</a><a href="#pricing">Pricing</a><a href="https://app.getwed.ai/login">Log in</a></div>
    <div><h4>Company</h4><a href="#">About</a><a href="#">Contact</a></div>
    <div><h4>Legal</h4><a href="#">Privacy</a><a href="#">Terms</a></div>
  </div>
  <div class="container footer-bottom">&copy; 2026 Veil. Made with love for couples everywhere.</div>
</footer>
```

**Note:** copy the actual footer link set from `index-old-backup.html` — the spec says "same links as current." Use the backup's exact columns/links/copyright text, restyled with the classes above.

- [ ] **Step 2: Add CSS** — replace `/* ============ FINAL CTA + FOOTER (Task 12) ============ */`:

```css
.final{background:
  radial-gradient(110% 55% at 25% 20%,rgba(201,169,110,.10) 0%,transparent 60%),
  radial-gradient(90% 50% at 80% 75%,rgba(212,186,133,.08) 0%,transparent 60%),
  var(--dark);
  color:#F5EFE6;padding:150px 0;text-align:center}
.final-h{font-family:var(--serif);font-weight:400;font-size:clamp(36px,5.4vw,68px);line-height:1.12;letter-spacing:-.015em}
.final-em{font-style:italic;position:relative;display:inline-block}
.final-underline{position:absolute;left:0;right:0;bottom:-.12em;width:100%;height:.18em}
.final-underline path{stroke-dasharray:300;stroke-dashoffset:0}
.final-sub{color:#B8AC9C;font-size:17px;margin:26px auto 38px;max-width:480px}
.final-cta{background:var(--cream);color:var(--charcoal)}
.final-cta:hover{transform:translateY(-2px);box-shadow:0 16px 36px -14px rgba(0,0,0,.5)}
.footer{background:var(--dark);color:#8F8475;padding:70px 0 36px;border-top:1px solid rgba(245,239,230,.08)}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
.footer-brand{font-family:var(--serif);font-size:26px;color:#F5EFE6}
.footer-tag{font-size:14px;margin-top:10px}
.footer h4{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6E6457;margin-bottom:16px}
.footer-grid a{display:block;font-size:14.5px;padding:5px 0}
.footer-grid a:hover{color:#F5EFE6}
.footer-bottom{margin-top:56px;padding-top:24px;border-top:1px solid rgba(245,239,230,.08);font-size:13px}
@media(max-width:768px){.final{padding:90px 0}.footer-grid{grid-template-columns:1fr 1fr;gap:32px}}
```

- [ ] **Step 3: Add JS** — replace `/* FINAL CTA JS (Task 12) */`:

```js
if (HAS_GSAP && !REDUCED) {
  gsap.to('.final .line-inner',{y:0,duration:1,stagger:.12,ease:'power3.out',
    scrollTrigger:{trigger:'.final',start:'top 65%'}});
  gsap.fromTo('.final-underline path',{strokeDashoffset:300},{strokeDashoffset:0,duration:1.1,ease:'power2.inOut',
    scrollTrigger:{trigger:'.final',start:'top 55%'}});
}
```

- [ ] **Step 4: Verify** — `$B scroll .final`, wait 1.5s, screenshot: dark section, headline revealed, gold underline drawn under "spreadsheet.", cream pill CTA, footer columns below.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: dark final CTA with drawn gold underline and footer"`

---

### Task 13: Generic reveals + mobile & reduced-motion hardening

**Files:**
- Modify: `/Users/mgiancristofaro/veil-landing/index.html`

- [ ] **Step 1: Add the generic reveal system** — replace `/* GENERIC REVEALS (Task 13) */`:

```js
if (HAS_GSAP && !REDUCED) {
  // every .fade-up not already animated by a section script
  gsap.utils.toArray('.fade-up').forEach(el=>{
    gsap.to(el,{opacity:1,y:0,duration:.8,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 88%'}});
  });
} else {
  // belt & braces: ensure nothing stays hidden
  document.querySelectorAll('.fade-up').forEach(el=>{el.style.opacity=1;el.style.transform='none';});
  document.querySelectorAll('.line-inner').forEach(el=>{el.style.transform='none';});
}
```

**Ordering requirement:** this block must run AFTER the hero timeline (Task 5) so hero `.fade-up` elements aren't double-animated. Either exclude hero elements (`.fade-up:not(.hero *)` is invalid CSS — instead filter in JS: `gsap.utils.toArray('.fade-up').filter(el=>!el.closest('.hero'))`) — **use the filter approach**.

- [ ] **Step 2: Add reduced-motion CSS kill-switch** — replace `/* ============ MOBILE + REDUCED MOTION (Task 13) ============ */`:

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important}
  .line-inner{transform:none!important}
  .fade-up{opacity:1!important;transform:none!important}
  .product-frame{transform:none!important}
  .hero-canvas{display:none!important}
}
```

- [ ] **Step 3: Mobile audit pass** — `$B viewport 375x812`, `$B reload`, then walk the whole page (`$B js "window.scrollTo(0,N)"` in 800px increments), screenshot each stop. Check: no horizontal overflow (`$B js "document.documentElement.scrollWidth"` → `375`), nav shows logo+login+CTA only, hero static silk gradient (no canvas: `$B js "getComputedStyle(document.querySelector('.hero-canvas')).display"` → contains `none` OR `silk-static` class present), story stacked, all text readable. Repeat at `390x844`.

- [ ] **Step 4: Tap-target audit** — `$B js "[...document.querySelectorAll('a,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<44)}).map(e=>e.className).join(',')"` — footer links and nav links may be <44px tall; acceptable for inline text links, but all standalone buttons (`.btn`, `.quote-dash`) must be ≥44px. Fix any standalone control under 44px by increasing padding.

- [ ] **Step 5: Reduced-motion verification** — `$B cdp Emulation.setEmulatedMedia '{"features":[{"name":"prefers-reduced-motion","value":"reduce"}]}'` then `$B reload`, screenshot top/middle/bottom: all content visible immediately, no canvas, no pinning (story stacked), quotes static with working dashes (`$B click '[data-go="2"]'` swaps instantly).

- [ ] **Step 6: Commit** — `git add index.html && git commit -m "feat: generic scroll reveals, reduced-motion kill-switch, mobile hardening"`

---

### Task 14: Full verification + Lighthouse + deploy

**Files:**
- No new code (fixes only, as found)

- [ ] **Step 1: Desktop walkthrough** — `$B viewport 1440x900`, `$B reload`, slow-scroll the page top to bottom with screenshots at each section. Confirm against spec: silk shader drifts, headline clip-mask reveal, product rises/straightens, hairlines draw + count-ups, story pins for ~4 viewports with 4 chapter swaps and internal vignette animations + progress rail, numerals cascade, quotes auto-advance with word stagger, pricing shimmer + checklist stagger, dark CTA underline draws. `$B console --errors` → empty.

- [ ] **Step 2: CDN-failure degradation check** — `$B cdp Network.setBlockedURLs '{"urls":["*cdnjs.cloudflare.com*","*unpkg.com*"]}'` (if this CDP method is not allowlisted, instead temporarily rename the script `src` attributes via `$B js` after load is not valid — alternative: open the file with network offline: `$B cdp Network.emulateNetworkConditions '{"offline":true,"latency":0,"downloadThroughput":-1,"uploadThroughput":-1}'` then reload; fonts/screenshot will also fail which is fine). Verify: all copy readable, layout intact, nothing invisible. Re-enable network after.

- [ ] **Step 3: Lighthouse mobile** —

```bash
cd ~/veil-landing && python3 -m http.server 8742 &
npx lighthouse http://localhost:8742 --preset=perf --form-factor=mobile --screenEmulation.mobile --quiet --chrome-flags="--headless" --only-categories=performance,accessibility --output=json --output-path=/tmp/lh.json
python3 -c "import json;d=json.load(open('/tmp/lh.json'));print('perf',d['categories']['performance']['score']*100,'a11y',d['categories']['accessibility']['score']*100)"
kill %1
```
Expected: Performance ≥ 85, Accessibility ≥ 95. If below: lazy-decode the screenshot (`loading="lazy"` is wrong for hero — keep `fetchpriority="high"` but ensure `decoding="async"`), check CLS from font swap (`font-display:swap` already via Google Fonts URL), fix contrast/aria issues reported.

- [ ] **Step 4: Commit fixes** — `git add -A && git commit -m "fix: lighthouse and degradation fixes"` (skip if no changes).

- [ ] **Step 5: Deploy**

```bash
cd ~/veil-landing && npx vercel --prod
```

- [ ] **Step 6: Verify live** — `$B goto https://<deployment-url>` (use the URL vercel prints; also check the production domain the project serves). Desktop screenshot + `$B viewport 375x812` mobile screenshot + console clean. Confirm CTAs link to `https://app.getwed.ai/signup` (`$B js "[...document.querySelectorAll('a[href*=signup]')].length"` ≥ 4).

- [ ] **Step 7: Final commit + cleanup**

```bash
cd ~/veil-landing && git add -A && git commit -m "chore: final deployed landing page" --allow-empty
rm index-old-backup.html && git add -A && git commit -m "chore: remove old landing page backup"
```

---

## Self-Review Notes

- **Spec coverage:** Nav (T2), Hero silk+rise (T3-5), Proof strip (T6), Pinned story w/ rail + vignettes + mobile stacking (T7-8), How it works (T9), Testimonials w/ pause + reduced-motion static (T10), Pricing (T11), Dark CTA + footer (T12), Degradation ladder + mobile + tap targets (T13), Verification ladder + Lighthouse + deploy (T14). All spec sections mapped.
- **Shader deviation documented** in Task 4 (fragment-shader silk instead of displaced plane — same visual, better perf).
- **Copy preservation:** Tasks 10/11/12 instruct pulling exact testimonial/pricing/footer text from `index-old-backup.html`.
- **Type consistency:** capability flags `REDUCED/MOBILE/HAS_GSAP/HAS_THREE` defined once (T1) and referenced by name in T2,4,5,6,8,9,10,11,12,13. Class vocabulary (`.fade-up`, `.line-mask/.line-inner`, `.kicker`, `.hairline`, `.sect-h`) defined in T1/T9 and reused consistently.
