<script>
  import { page } from '$app/stores';
  let { data, children } = $props();

  const showNav = $derived($page.route.id !== '/theprogram');

  const navItems = [
    { href: '/theprogram/show', label: 'The Show' },
    { href: '/theprogram/commish', label: 'Commish View' },
    { href: '/theprogram/config', label: 'Config' }
  ];

  // Background variant toggle for design review.
  // Append ?bg=<name> to any /theprogram/* URL:
  //   (default)     — current dark crimson
  //   ?bg=soft      — lighter crimson wash
  //   ?bg=pewter    — neutral grey-brown
  //   ?bg=sepia     — warm vintage brown
  //   ?bg=navy      — cool storm blue
  //   ?bg=curtain   — gold-to-deep-crimson stage curtain vignette
  const bgVariant = $derived($page.url.searchParams.get('bg') ?? '');
  const variantLabels = {
    '': 'Default · dark crimson',
    soft: 'Soft · muted crimson',
    sepia: 'Sepia · vintage leather',
    charcoal: 'Charcoal · neutral dark',
    forest: 'Forest · gridiron green',
    bordeaux: 'Bordeaux · deep wine',
    // Light tan / cream family — flat solid colors. Cream cards + cream
    // text will lose contrast on these; useful for comparing the warm /
    // light direction.
    tan: 'Tan · #DCC3AA',
    cream: 'Cream · #F1E2D1',
    ivory: 'Ivory · #FFFDE1',
    wheat: 'Wheat · #E6CFA9',
    honey: 'Honey · #E8C999',
    beige: 'Beige · #F1E3D3',
    parchment: 'Parchment · #E5D0AC',
    coffee: 'Coffee · #AF8260'
  };

  // Build a pill URL that preserves every other query param on the page
  // (e.g. ?conf=C1&i=0) and just swaps/clears the bg key.
  function bgHref(value) {
    const params = new URLSearchParams($page.url.searchParams);
    if (value) params.set('bg', value);
    else params.delete('bg');
    const qs = params.toString();
    return $page.url.pathname + (qs ? `?${qs}` : '');
  }
</script>

<svelte:head>
  <title>The Program · down bad ↓</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Alfa+Slab+One&family=Bebas+Neue&family=Courier+Prime:wght@400;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="tp-app" data-bg={bgVariant}>
  {#if showNav}
    <nav class="tp-nav">
      <div class="tp-nav-inner">
        <a href="/theprogram/" class="tp-brand" aria-label="The Program">
          {#if data?.tpLogoUrl}
            <img src={data.tpLogoUrl} alt="The Program" class="tp-brand-logo" referrerpolicy="no-referrer" />
          {:else}
            <span class="tp-brand-text">
              <span class="tp-brand-the">The</span>
              <span class="tp-brand-program">Program</span>
            </span>
          {/if}
        </a>
        <div class="tp-nav-links">
          {#each navItems as item}
            <a
              href={item.href}
              class="tp-nav-link"
              class:active={$page.url.pathname.startsWith(item.href)}
            >{item.label}</a>
          {/each}
        </div>
      </div>
      <div class="tp-nav-rule" aria-hidden="true"></div>
    </nav>
  {/if}

  <main class="tp-main">
    {@render children()}
  </main>

  <!-- Background variant picker (dev/review only). Append ?bg=<name> to
       any /theprogram/* URL to compare options live. -->
  <div class="tp-bg-picker" aria-label="Background variant picker">
    <div class="tp-bg-picker-label">Backdrop · {variantLabels[bgVariant] ?? variantLabels['']}</div>
    <div class="tp-bg-picker-buttons">
      {#each [
        ['', 'Default'], ['soft', 'Soft'], ['sepia', 'Sepia'],
        ['charcoal', 'Charcoal'], ['forest', 'Forest'], ['bordeaux', 'Bordeaux'],
        ['tan', 'Tan'], ['cream', 'Cream'], ['ivory', 'Ivory'], ['wheat', 'Wheat'],
        ['honey', 'Honey'], ['beige', 'Beige'], ['parchment', 'Parchment'], ['coffee', 'Coffee']
      ] as [v, label]}
        <a
          class="tp-bg-pill"
          class:active={bgVariant === v}
          href={bgHref(v)}
          data-sveltekit-noscroll
        >{label}</a>
      {/each}
    </div>
  </div>
</div>

<style>
  /* ============================================================
     Vintage Varsity — Crimson (pulled from the logo)
     ============================================================ */
  .tp-app {
    /* Primary chrome */
    --tp-navy: #B8252C;       /* repurposed token: crimson */
    --tp-navy-2: #C73238;     /* lighter crimson */
    --tp-navy-dark: #8C1B22;  /* deeper crimson */
    /* Surfaces */
    --tp-cream: #F4ECDD;
    --tp-cream-2: #EBE0CB;
    --tp-cream-3: #DDD0B4;
    /* Accent */
    --tp-gold: #D9A441;
    --tp-gold-2: #B98624;
    --tp-gold-soft: #ECC880;
    /* Pewter (chrome bevel from the logo) */
    --tp-pewter: #BFB8AD;
    --tp-pewter-2: #8F8979;
    /* Warning / oxblood */
    --tp-oxblood: #7A1F2B;
    --tp-oxblood-soft: #A03A47;
    /* Ink */
    --tp-ink: #2B1815;
    --tp-ink-soft: #5B3F38;
    --tp-muted: #7A6A55;
    /* Rules */
    --tp-rule: rgba(184, 37, 44, 0.28);
    --tp-rule-soft: rgba(184, 37, 44, 0.12);

    --tp-display: 'Alfa Slab One', 'Oswald', 'Bebas Neue', 'Impact', serif;
    --tp-display-condensed: 'Oswald', 'Bebas Neue', 'Impact', sans-serif;
    --tp-body: 'Lora', 'Caslon', Georgia, 'Times New Roman', serif;

    /* Full-bleed backdrop used by .entry, .stage, .launcher, .theater.
       Default = current dark crimson; variant overrides below. */
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(199, 50, 56, 0.55) 0%,
        rgba(184, 37, 44, 0.55) 55%,
        rgba(140, 27, 34, 0.7) 100%),
      #1a0608;

    min-height: 100vh;
    background: var(--tp-cream);
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-feature-settings: 'onum' 1, 'liga' 1, 'kern' 1;
  }

  /* ============================================================
     Background variants — toggle via ?bg=<name> on any URL.
     Each replaces --tp-stage-bg so all four full-bleed surfaces
     pick it up.
     ============================================================ */
  /* Soft — lighter, more washed-out crimson (less crushing). */
  .tp-app[data-bg="soft"] {
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(199, 50, 56, 0.22) 0%,
        rgba(184, 37, 44, 0.28) 55%,
        rgba(140, 27, 34, 0.42) 100%),
      #3a1518;
  }
  /* Sepia — vintage leather, warm reddish-brown (no yellow / olive
     undertones). Reads like an old letterman jacket or cracked
     book spine. */
  .tp-app[data-bg="sepia"] {
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(175, 100, 65, 0.28) 0%,
        rgba(130, 70, 50, 0.45) 60%,
        rgba(75, 38, 26, 0.72) 100%),
      #241510;
  }
  /* Charcoal — neutral dark grey, lets gold + crimson accents pop
     without competing tonally. */
  .tp-app[data-bg="charcoal"] {
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(150, 150, 150, 0.22) 0%,
        rgba(85, 85, 85, 0.45) 60%,
        rgba(35, 35, 35, 0.72) 100%),
      #181818;
  }
  /* Forest — deep gridiron green. Cool counterpoint to the crimson
     brand chrome. */
  .tp-app[data-bg="forest"] {
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(80, 140, 95, 0.28) 0%,
        rgba(45, 95, 65, 0.48) 60%,
        rgba(20, 55, 35, 0.78) 100%),
      #0e2419;
  }
  /* Bordeaux — deep wine red, same family as the crimson but darker
     and more elegant. */
  .tp-app[data-bg="bordeaux"] {
    --tp-stage-bg:
      radial-gradient(ellipse at top,
        rgba(125, 35, 55, 0.32) 0%,
        rgba(90, 22, 42, 0.55) 60%,
        rgba(50, 10, 22, 0.82) 100%),
      #1a060e;
  }
  /* Light tan / cream family — flat solid colors per request. These
     will desaturate the cream school cards and cream player text,
     so card / typography colors would need adjusting if one is chosen
     as the final default. */
  .tp-app[data-bg="tan"]       { --tp-stage-bg: #DCC3AA; }
  .tp-app[data-bg="cream"]     { --tp-stage-bg: #F1E2D1; }
  .tp-app[data-bg="ivory"]     { --tp-stage-bg: #FFFDE1; }
  .tp-app[data-bg="wheat"]     { --tp-stage-bg: #E6CFA9; }
  .tp-app[data-bg="honey"]     { --tp-stage-bg: #E8C999; }
  .tp-app[data-bg="beige"]     { --tp-stage-bg: #F1E3D3; }
  .tp-app[data-bg="parchment"] { --tp-stage-bg: #E5D0AC; }
  .tp-app[data-bg="coffee"]    { --tp-stage-bg: #AF8260; }

  /* Floating dev picker — sits in the bottom-right so it doesn't
     intrude on the show layout. Remove this block when a variant
     is finalized. */
  .tp-bg-picker {
    position: fixed;
    bottom: 14px;
    right: 14px;
    z-index: 100;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.55);
    color: var(--tp-cream);
    border: 1px solid rgba(244, 236, 221, 0.25);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .tp-bg-picker-label {
    margin-bottom: 6px;
    color: var(--tp-gold-soft);
    font-weight: 700;
  }
  .tp-bg-picker-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
  .tp-bg-pill {
    padding: 4px 8px;
    border: 1px solid rgba(244, 236, 221, 0.3);
    border-radius: 999px;
    text-decoration: none;
    color: var(--tp-cream);
    font-size: 10px;
    letter-spacing: 0.1em;
  }
  .tp-bg-pill:hover { background: rgba(244, 236, 221, 0.12); }
  .tp-bg-pill.active {
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
    border-color: var(--tp-gold-2);
  }

  .tp-app :global(*) { box-sizing: border-box; }

  /* Headings — keep specificity at 0 so per-page color wins */
  .tp-app :global(:where(h1, h2, h3)) {
    font-family: var(--tp-display-condensed);
    color: var(--tp-navy);
    letter-spacing: 0.02em;
    margin: 0;
  }

  /* Stamps — week numbers, conference badges */
  .tp-app :global(.tp-stamp) {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: inline-block;
    padding: 4px 12px;
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-radius: 2px;
  }
  .tp-app :global(.tp-stamp-gold) {
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
  }
  .tp-app :global(.tp-stamp-oxblood) {
    background: var(--tp-oxblood);
    color: var(--tp-cream);
  }

  /* Section divider with centered ornament */
  .tp-app :global(.tp-divider) {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 28px 0;
    color: var(--tp-rule);
  }
  .tp-app :global(.tp-divider::before),
  .tp-app :global(.tp-divider::after) {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--tp-rule);
  }
  .tp-app :global(.tp-divider-ornament) {
    color: var(--tp-gold);
    font-size: 14px;
    letter-spacing: 0.4em;
  }

  /* "Small word + big word" stacked head (THE • PROGRAM rhythm).
     Usage:
       <h1 class="tp-stack-head">
         <span class="tp-stack-small">The</span>
         <span class="tp-stack-big">Draft Board</span>
       </h1>
  */
  .tp-app :global(.tp-stack-head) {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
  }
  .tp-app :global(.tp-stack-small) {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 0.3em;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-gold);
    transform: translateY(-0.25em);
  }
  .tp-app :global(.tp-stack-big) {
    font-family: var(--tp-display);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1;
  }

  /* Three-layer "stamped" display treatment (crimson fill, gold outline,
     pewter outer trim). Use for hero headlines on cream backdrops. */
  .tp-app :global(.tp-stamped) {
    color: var(--tp-navy);
    text-shadow:
      -1px -1px 0 var(--tp-gold),
       1px -1px 0 var(--tp-gold),
      -1px  1px 0 var(--tp-gold),
       1px  1px 0 var(--tp-gold),
      -2px -2px 0 var(--tp-pewter),
       2px -2px 0 var(--tp-pewter),
      -2px  2px 0 var(--tp-pewter),
       2px  2px 0 var(--tp-pewter),
       0  4px 0 var(--tp-pewter-2),
       0  6px 0 rgba(0, 0, 0, 0.18);
  }
  /* Cream-fill variant for crimson backdrops */
  .tp-app :global(.tp-stamped-cream) {
    color: var(--tp-cream);
    text-shadow:
      -1px -1px 0 var(--tp-gold),
       1px -1px 0 var(--tp-gold),
      -1px  1px 0 var(--tp-gold),
       1px  1px 0 var(--tp-gold),
      -2px -2px 0 var(--tp-pewter),
       2px -2px 0 var(--tp-pewter),
      -2px  2px 0 var(--tp-pewter),
       2px  2px 0 var(--tp-pewter),
       0  4px 0 var(--tp-navy-dark),
       0  8px 24px rgba(0, 0, 0, 0.45);
  }

  /* Pill buttons */
  .tp-app :global(.tp-pill) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 28px;
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-decoration: none;
    border-radius: 999px;
    cursor: pointer;
    border: 1.5px solid var(--tp-navy);
    background: var(--tp-cream);
    color: var(--tp-navy);
    transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
  }
  .tp-app :global(.tp-pill:hover:not(:disabled)) {
    background: var(--tp-cream-2);
    box-shadow: 0 2px 0 var(--tp-navy);
    transform: translateY(-1px);
  }
  .tp-app :global(.tp-pill:disabled) { opacity: 0.45; cursor: not-allowed; }

  .tp-app :global(.tp-pill-gold) {
    background: var(--tp-gold);
    border-color: var(--tp-gold-2);
    color: var(--tp-navy-dark);
    box-shadow: inset 0 -2px 0 var(--tp-gold-2);
  }
  .tp-app :global(.tp-pill-gold:hover:not(:disabled)) {
    background: var(--tp-gold-soft);
    box-shadow: 0 3px 0 var(--tp-gold-2), inset 0 -2px 0 var(--tp-gold-2);
  }
  .tp-app :global(.tp-pill-navy) {
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-color: var(--tp-navy-dark);
  }
  .tp-app :global(.tp-pill-navy:hover:not(:disabled)) {
    background: var(--tp-navy-2);
  }
  .tp-app :global(.tp-pill-small) {
    padding: 8px 16px;
    font-size: 12px;
  }

  /* Cream card with letterpress edge */
  .tp-app :global(.tp-card) {
    background: var(--tp-cream);
    border: 1px solid var(--tp-rule);
    border-radius: 6px;
    box-shadow:
      inset 0 0 0 1px rgba(244, 236, 221, 0.9),
      0 1px 0 rgba(184, 37, 44, 0.06);
  }

  /* Form fields with notebook feel */
  .tp-app :global(.tp-field) {
    display: block;
    width: 100%;
    padding: 10px 12px;
    background: rgba(244, 236, 221, 0.5);
    border: 1px solid var(--tp-rule);
    border-radius: 4px;
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-size: 15px;
  }
  .tp-app :global(.tp-field:focus) {
    outline: none;
    border-color: var(--tp-gold-2);
    box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.3);
    background: var(--tp-cream);
  }
  .tp-app :global(.tp-label) {
    display: block;
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--tp-muted);
    margin-bottom: 6px;
  }

  .tp-app :global(.tp-alert) {
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 16px;
    font-family: var(--tp-body);
  }
  .tp-app :global(.tp-alert-error) {
    background: rgba(122, 31, 43, 0.08);
    border: 1px solid var(--tp-oxblood);
    color: var(--tp-oxblood);
  }
  .tp-app :global(.tp-alert-ok) {
    background: rgba(217, 164, 65, 0.14);
    border: 1px solid var(--tp-gold-2);
    color: var(--tp-navy-dark);
  }

  /* ============================================================
     Nav
     ============================================================ */
  .tp-nav {
    background: var(--tp-navy);
    color: var(--tp-cream);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .tp-nav-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 14px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .tp-brand {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    color: var(--tp-cream);
    gap: 12px;
  }
  .tp-brand-logo {
    height: 40px;
    width: auto;
    display: block;
  }
  .tp-brand-text {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1;
  }
  .tp-brand-the {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-gold);
  }
  .tp-brand-program {
    font-family: var(--tp-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tp-cream);
  }
  .tp-nav-links { display: flex; gap: 6px; }
  .tp-nav-link {
    padding: 8px 16px;
    border-radius: 2px;
    text-decoration: none;
    color: var(--tp-cream);
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border-bottom: 2px solid transparent;
    transition: border-color 0.12s ease, color 0.12s ease;
  }
  .tp-nav-link:hover { color: var(--tp-gold-soft); }
  .tp-nav-link.active {
    color: var(--tp-cream);
    border-bottom-color: var(--tp-gold);
  }
  .tp-nav-rule {
    height: 4px;
    background:
      linear-gradient(
        90deg,
        var(--tp-gold) 0,
        var(--tp-gold) 33.333%,
        var(--tp-cream) 33.333%,
        var(--tp-cream) 66.666%,
        var(--tp-gold) 66.666%,
        var(--tp-gold) 100%
      );
  }

  .tp-main { width: 100%; }
</style>
