# The Program — Design System (Technical Reference)

Captures the current state of the visual language for `/theprogram/` after the wheat-backdrop refactor. Tokens, components, states, motion, and accessibility decisions.

Source of truth:
- Tokens + global theme: [src/routes/theprogram/+layout.svelte](../src/routes/theprogram/+layout.svelte)
- Show page (cards, stamps, animations, reveals): [src/routes/theprogram/show/+page.svelte](../src/routes/theprogram/show/+page.svelte)
- Entry page (week-start form, headline stamp): [src/routes/theprogram/+page.svelte](../src/routes/theprogram/+page.svelte)
- Config + commish pages share the same token surface but are utility-form-heavy.

---

## 1. Theme & tokens

The theme is named "Vintage Varsity — Crimson". Color tokens are declared on `.tp-app` (the layout wrapper) and cascade to every descendant. Note that several legacy `--tp-navy*` tokens have been repurposed as **crimson** (the brand red); rename has not happened yet.

### 1.1 Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--tp-navy` | `#B8252C` | Primary crimson (repurposed) — borders, fills, headline glyph fills |
| `--tp-navy-2` | `#C73238` | Lighter crimson — hover state for crimson fills |
| `--tp-navy-dark` | `#8C1B22` | Deep crimson — body text on wheat, under-rule shadows |
| `--tp-cream` | `#F4ECDD` | Primary card surface; text on crimson fills |
| `--tp-cream-2` | `#EBE0CB` | Hover surface for cream pills |
| `--tp-cream-3` | `#DDD0B4` | (reserved) deeper cream tier |
| `--tp-gold` | `#D9A441` | Accent — gold fills, active conference pill, edit-btn |
| `--tp-gold-2` | `#B98624` | Darker gold — borders + inset shadows on gold pills |
| `--tp-gold-soft` | `#ECC880` | Lightest gold tier — gold-pill hover, edit-modal eyebrow |
| `--tp-pewter` | `#BFB8AD` | (reserved) chrome bevel from legacy stamped-cream variant |
| `--tp-pewter-2` | `#8F8979` | (reserved) deeper chrome |
| `--tp-oxblood` | `#7A1F2B` | Warning / "out" — pct-bad, .stayed bolds, prev-note body |
| `--tp-oxblood-soft` | `#A03A47` | Lighter oxblood — reserved |
| `--tp-ink` | `#2B1815` | Near-black for body copy on cream |
| `--tp-ink-soft` | `#5B3F38` | Muted ink |
| `--tp-muted` | `#5A4A35` | Muted captions / labels on wheat (AA 4.5:1) |
| `--tp-rule` | `rgba(184,37,44,0.28)` | Crimson @ 28% alpha — section rules |
| `--tp-rule-soft` | `rgba(184,37,44,0.12)` | Crimson @ 12% alpha — soft rules |
| `--tp-stage-bg` | `#E6CFA9` | **Wheat** — the locked-in show backdrop |

### 1.2 Type stacks

| Token | Stack | Role |
| --- | --- | --- |
| `--tp-display` | `'Alfa Slab One', 'Oswald', 'Bebas Neue', 'Impact', serif` | Hero headlines (`tp-stamped`, recruit/winner/launcher titles) |
| `--tp-display-condensed` | `'Oswald', 'Bebas Neue', 'Impact', sans-serif` | Eyebrows, labels, percentages, button text, conference name on stamps |
| `--tp-body` | `'Lora', 'Caslon', Georgia, 'Times New Roman', serif` | Italic body prose (steal messages, prev-note, foot text) |

### 1.3 Backdrop

`.tp-app` paints `#E6CFA9` (wheat) full-bleed on `<body>`. There is no pinstripe overlay. The wheat is intentionally calm — it acts as the "stage floor" and lets crimson cards and gold pills carry the brand color.

---

## 2. Layout primitives

### 2.1 Entry card ([+page.svelte](../src/routes/theprogram/+page.svelte))

- 720px max, cream surface, multi-ring border-via-box-shadow:
  `0 0 0 1px var(--tp-rule), 0 0 0 8px var(--tp-navy), 0 0 0 9px var(--tp-gold), 0 30px 60px rgba(0,0,0,0.4)`
- Houses week-number form, CSV/paste input, week loader.
- Headline uses the **stacked-head** pattern (see §3.1).

### 2.2 Stage (commish-side surfaces)

A central cream card that hosts ordering / "show complete" / loading states. Same border stack as entry. Used for `Conference Order`, `Show Complete`, `No Events to Show`.

### 2.3 Launcher

Per-conference grid of recruit tiles. Sits directly on the wheat backdrop (no card surround).
- `.launcher-eyebrow` — `--tp-navy-dark`, 12px, letter-spacing 0.4em.
- `.launcher-title` — uses `.tp-stamped-cream` (see §3.2).
- `.launcher-meta` — inline-flex; week stamp (gold) + "X / Y rolled" count in `--tp-navy-dark`.
- `.launcher-sub` — italic body, navy-dark via global override.

### 2.4 Theater (event view)

The reveal stage for a single recruit. Top-bar (Return-to-List + breadcrumb + edit-btn), recruit name as `.tp-stamped-cream` H1, then either the schools grid (pre-roll / locked / stayed) or the winner card (commit / steal-success / auto-commit).

---

## 3. Headlines & stamps

### 3.1 Stacked-head pattern

```html
<h1 class="tp-stack-head">
  <span class="tp-stack-small">The</span>
  <span class="tp-stack-big tp-stamped">Program</span>
</h1>
```

- `.tp-stack-small` — 0.3em condensed, gold, translateY(-0.25em).
- `.tp-stack-big` — display font, uppercase, no color set (inherits or gets `tp-stamped`).

### 3.2 `tp-stamped` (cream-surface H1s)

```
color: var(--tp-navy);
text-shadow:
  0 4px 0 var(--tp-navy-dark),
  0 6px 0 rgba(0,0,0,0.18);
```

Solid crimson fill, deeper-crimson under-rule, soft cast shadow. **No gold / pewter outline.** Used on the entry page H1 and stage titles.

### 3.3 `tp-stamped-cream` (wheat-backdrop H1s)

```
color: var(--tp-navy);
text-shadow:
  0 2px 0 var(--tp-navy-dark),
  0 6px 18px rgba(0,0,0,0.18);
```

Same crimson treatment, tuned for the wheat field — flatter under-rule, blurred ground shadow. Used on `event-player`, `winner-name`, `launcher-title`.

### 3.4 Rubber-stamp (`.rect-stamp`)

Black-ink rectangular stamp that drops onto player names (`STOLEN`, `LOYAL`) and onto the locked school card (`LOCKED`, `AUTO COMMIT`).

- `--stamp-ink: #111111` (currentColor cascades to border, outline, text-stroke).
- `border: 8px solid currentColor`, `outline: 2px solid currentColor`, `outline-offset: 4px`, plus `box-shadow: inset 0 0 0 3px currentColor`. The triple ring is the entire visual.
- `background: transparent` — sits directly on whatever surface is beneath.
- Variants:
  - `.player-stamp` — anchored `top: 58%`, `right: -60px`, `rotate(-7deg)`. Overhangs the right edge of the player name.
  - `.card-stamp` — centered over the helmet (`top/left: 50%`), scaled down (`stamp-label` 1.4rem vs 4.8rem).

### 3.5 Small chip stamps (`.tp-stamp`)

Used for conference names, week chips. 14px condensed bold @ letter-spacing 0.18em.
- Default: crimson fill, cream text.
- `.tp-stamp-gold`: gold fill, navy-dark text.
- `.tp-stamp-oxblood`: oxblood fill, cream text.

---

## 4. Cards

### 4.1 Reveal cards (school / winner / recruit)

All three share a global treatment via the layout's `:global` block:

```
background: var(--tp-cream);   /* white-ish */
color: var(--tp-navy-dark);
border-color: var(--tp-navy);
```

White cream tile with crimson border + crimson text. Internal labels (`.school-name`, `.pct-big`, `.recruit-player`, `.recruit-num`) all read in `--tp-navy-dark` for AA contrast on cream.

### 4.2 School card (`.school-card`)

Local geometry: `width: 200px`, `padding: 18px 14px 14px`, `border: 2px solid`, `border-radius: 4px`, `box-shadow: 0 4px 0 rgba(0,0,0,0.25)` (letterpress depth).

States:
- `.committed` — gold border + gold halo `box-shadow: 0 0 0 3px var(--tp-gold)`. `.committed-banner` rides above as a gold pill.
- `.ineligible` — same white card; helmet drops to `opacity: 0.35; filter: grayscale(1)`; red X badge (`.x-badge`) in the top-right corner.
- Inside `.schools-locked .school-card.committed`:
  - `locked-pulse` animation (gold halo breathes 3px ↔ 8px every 1.5s).
  - `.school-name` jumps 16px → 22px and goes `#111`.
  - `.pct-big` / `.school-pct` / `.pct-big small` all flip to `#111`.

### 4.3 Helmet treatment

- `.helmet-frame` — 180×180 grid-centered container.
- `.helmet` — `max-width/height: 100%`, `object-fit: contain`, `mix-blend-mode: multiply`. The blend mode kills white-background bleed in source PNGs against the cream card.
- `.helmet-placeholder` — transparent background, muted glyph (72px first letter of school) for missing imagery.

### 4.4 Winner card (`.winner-card`)

280×280 white tile, `border: 2px solid var(--tp-navy-dark)`, drop shadow `0 8px 30px rgba(0,0,0,0.45)`. Scaled 1.02. Contains the winning helmet (`.winner-img`, also `mix-blend-mode: multiply`). Paired with the radial `.winner-ring` overlay for the reveal flourish.

### 4.5 Recruit card (launcher tile)

Default: cream surface, navy player name. Becomes `.done` after the recruit has been rolled — background flips to `--tp-navy-dark` with cream text overrides on `.recruit-player` and `.recruit-num`.

---

## 5. Buttons & pills

### 5.1 Base `.tp-pill`

```
padding: 14px 28px;
border-radius: 999px;
font-family: var(--tp-display-condensed);
font-size: 15px; font-weight: 700; letter-spacing: 0.18em;
text-transform: uppercase;
background: var(--tp-cream);
color: var(--tp-navy);
border: 1.5px solid var(--tp-navy);
```

Hover: cream-2 background + crimson under-rule + 1px lift.
Disabled: opacity 0.45.

### 5.2 Variants

- `.tp-pill-gold` — gold fill, gold-2 border, navy-dark text, gold-2 inset under-rule. Hover lightens to gold-soft.
- `.tp-pill-navy` — crimson fill, cream text, navy-dark border.
- `.tp-pill-small` — padding 8px 16px, 12px font.
- `.tp-pill-big` — used on the primary "Roll" button; oversized (24px font, 22px×72px padding) with extra letter-spacing.

### 5.3 Contextual overrides

- `.event-topbar .tp-pill` (Return-to-List at top of theater): solid crimson, cream text, hover → `--tp-navy-2`. No box-shadow / lift.
- `.control-row .tp-pill:not(.tp-pill-gold)` (bottom Return-to-List): same solid-crimson treatment, paired with a gold "Next Recruit" pill for clear red/gold hierarchy.
- `.edit-btn` (✎ pencil): 36px circle, gold fill, navy-dark glyph, gold-2 border. Hover lightens to gold-soft.

### 5.4 Conference jump pills (`.jump-pill`)

Solid crimson fill, navy-dark border, cream text. `.active` switches to gold fill + navy-dark text + gold-2 border. The active/inactive distinction reads as the same red/gold pair as the Return-to-List + Next-Recruit pair.

---

## 6. Outcome states & messaging

### 6.1 Steal flow (4 outcomes)

| Outcome | Trigger | Visual |
| --- | --- | --- |
| **Locked** | Committed school stays + commitment marked locked | Schools grid stays visible; bars drop; LOCKED rect-stamp lands on committed card; pulse halo; steal-message ("X has locked Y from being stolen.") fades in at 1.2s. |
| **Stayed** | Roll runs, original committed school wins | Stayed steal still runs the spinner; LOYAL stamp lands on the player name; steal-message ("Y has stayed loyal to X.") fades in at 2.0s. |
| **No Real Attempt** | All non-committed schools <25% | Skipped — no roll, immediate stayed outcome. |
| **Stolen** | A new school wins the roll | Spinner → winner card with new school + STOLEN stamp on player name; committed school disappears post-roll; steal-message ("Player has been stolen by X from Y.") fades in at 1.5s. |

#### Steal-message accent variants

- `.stolen` and `.locked` strongs → `#111` (black ink), underline color crimson.
- `.stayed` strongs → `--tp-oxblood` (warm), underline color gold.

### 6.2 Commit flow

- Standard roll → spinner decelerates onto winner; winner card scales in; cream-bg → confetti.
- **Upset ceremony** (winner <25%): adds the 9-phase upset overlay (slow rotation, gradient sweep, etc).
- **Solo commit**: only one eligible school → bypass spinner, deterministic reveal.

### 6.3 Auto-commit flow

- **Megaphone phase**: 45 megaphone particles burst from the bidder card. Slow, dramatic.
- **Solo**: only one bidder → reveal winner card directly post-megaphone.
- **Contested**: ≥2 bidders. Renders `.ac-phase2-eyebrow` (`Auto-Commit Contested` — navy-dark) + prompt + roll button. The contested re-roll uses the same spinner as commit.

### 6.4 Ineligibility

- **Threshold**: schools below 25% raw odds are marked ineligible.
- **Top-5 cap**: if more than 5 eligible schools survive threshold, the 6th+ (ranked by raw odds) get demoted. Ties at the 5-position are all kept.

---

## 7. Animations

### 7.1 CSS keyframes

| Animation | Element | Notes |
| --- | --- | --- |
| `steal-message-in` | `.steal-message` | 0.4s ease-out fade + 8px rise. Per-variant `animation-delay`: locked 1.2s, stolen 1.5s, stayed 2.0s. |
| `locked-pulse` | `.schools-locked .school-card.committed` | Gold halo breathes 3px ↔ 8px, 1.5s ease-in-out infinite. |
| `bars-drop` | `.bars-overlay` | Bars image slams in on the locked card. |
| Stamp drop-in | `.rect-stamp.animate` | Scales + settles; rotation preserved via `--rot` custom prop. |
| Confetti burst | n/a (canvas) | 240-particle helmet burst on commit. |
| Megaphone burst | n/a (canvas + DOM) | 45 megaphones + JS RAF particles on auto-commit. |
| Spinner | `.spinner` | CSS `--spin-rot` custom prop driven by JS RAF deceleration. |

### 7.2 `prefers-reduced-motion`

Global block in layout collapses every animation and transition to 0.01ms. JS-driven RAF loops (spinner deceleration, confetti, megaphones) check `matchMedia('(prefers-reduced-motion: reduce)')` and skip the loop entirely, jumping to the resting state.

---

## 8. Accessibility decisions

Contrast targets: WCAG AA — 4.5:1 for body, 3:1 for large text (≥18px regular or ≥14px bold).

Notable corrections baked into the current state:
- `--tp-muted` darkened from `#7A6A55` (3.6:1) to `#5A4A35` (4.6:1) on wheat.
- Floating prose on wheat (steal-message, ac-solo-line, ac-phase2-prompt, stage-sub, launcher-sub, prev-note) routes to `--tp-navy-dark` (~7:1 on wheat). The brand crimson `--tp-navy` is only 4.1:1 — fine for large text, fails for body.
- `pct-bad` switched from oxblood (1.6:1 on crimson) to gold-soft (5:1 on crimson) historically; now reads `--tp-oxblood` against the white card (~6:1).
- Stamp ink (`#111`) reads cleanly against the transparent background since the underlying surface (cream card or wheat) is always light.
- `.tp-stamp` body labels bumped to 14px bold so navy-dark on gold passes 3:1 large-text.
- All `<img>` helmets have `alt=""` because the school name is rendered as a sibling — image is decorative.
- Modal: Escape closes, focus returns to the trigger, `aria-modal="true"`.
- Live regions: every reveal stage carries a `<div class="sr-only" role="status" aria-live="polite">` that announces the outcome verbally for screen-reader users.

### `.sr-only` utility

```
position: absolute;
width: 1px; height: 1px;
padding: 0; margin: -1px;
overflow: hidden;
clip: rect(0,0,0,0);
white-space: nowrap;
border: 0;
```

---

## 9. File map

| File | Responsibility |
| --- | --- |
| [+layout.svelte](../src/routes/theprogram/+layout.svelte) | `.tp-app` wrapper, token declarations, global theme (cards, pills, stamps, headlines), prefers-reduced-motion block, sr-only utility, headings, dividers. |
| [+page.svelte](../src/routes/theprogram/+page.svelte) | Entry/landing — week-start form + week loader. Hosts the headline stamp. |
| [show/+page.svelte](../src/routes/theprogram/show/+page.svelte) | The show. Cards, spinner, megaphone burst, confetti, reveal stages, edit modal, conference order + launcher, theater event view, all per-page CSS. ~2200 lines. |
| [commish/+page.svelte](../src/routes/theprogram/commish/+page.svelte) | Commissioner-side controls. |
| [config/+page.svelte](../src/routes/theprogram/config/+page.svelte) | Per-recruit odds editor with per-row aria-labels. |
| [src/lib/server/theprogram/show.js](../src/lib/server/theprogram/show.js) | `computeCommit`, `computeSteal`, `executeRoll`, `formatOutcomeLabel`, threshold + top-5 cap, late-joiner detection. |
| [src/lib/client/theprogram/confetti.js](../src/lib/client/theprogram/confetti.js) | 240-particle helmet burst, team-color k-means, helmet canvas preload + black-strip with CORS fallback. |

---

## 10. Backups

A pre-wheat snapshot of the five styled files lives at [`_design-backups/2026-05-26-pre-wheat/`](../_design-backups/2026-05-26-pre-wheat/). Restore: `cp -r _design-backups/2026-05-26-pre-wheat/theprogram/* src/routes/theprogram/`.
