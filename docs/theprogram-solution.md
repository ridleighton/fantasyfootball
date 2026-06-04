# The Program — Solution Summary

End-to-end overview of the `/theprogram/` recruiting show: data model, server flow, UI processes, and the visual system. Intended as a single-document onboarding for anyone touching the feature.

---

## 1. What "The Program" is

A weekly live recruiting show where a commissioner reveals, one recruit at a time, whether each player commits to a school, gets stolen by another, or auto-commits. Three event kinds drive everything: **commit**, **steal**, **auto-commit**. Each event is rolled (or short-circuited as solo/no-attempt) and the outcome is persisted so the show can be re-loaded or audited later.

Four pages back the feature, all under `/theprogram/`:

| Route | Role |
| --- | --- |
| `/theprogram/` | Entry. Start a new week (paste CSV / upload) or load an existing week. |
| `/theprogram/show` | The show itself. Sets conference order, then per-conference launcher + per-recruit theater. |
| `/theprogram/commish` | Commissioner-side view. Reads and edits all rows for the active week. |
| `/theprogram/config` | Asset config — conferences, schools, photo table (helmets, bars, locked image). |

---

## 2. Data model (Postgres / Neon)

All tables are namespaced `program_*`. They are not in `db/schema.sql` (that file holds the legacy picks app); the program tables were created out-of-band on Neon. The set in use:

| Table | Purpose |
| --- | --- |
| `program_weeks` | One row per week. PK `id`, unique `week_number`. |
| `program_active_week` | Singleton (`id = 1`) pointing at the currently loaded week. |
| `program_roll_events` | The line items of a week. One row per recruit-event with `week_id`, `conference`, `type` (commit / steal / auto-commit), `player`, `school` (committed-or-blank), `locked`, `in_original_roll`, `odds` (the raw odds string), `committed_school`, plus an `outcome` column populated after the roll executes. |
| `program_conferences` | The list of conference names available for the order picker. |
| `program_conference_order` | Per-week ordering: which conferences run, in what order. |
| `program_schools` | Schools with helmet image URLs. Joined into the roll display so each card knows its helmet. |
| `program_photos` | Photo table — `Bars` (the locked-steal slam overlay), `Locked Image`, helmet placeholder, etc. Keyed by a string `slug`. |

### Round-trip lifecycle

1. **Start week** ([+page.server.js](../src/routes/theprogram/+page.server.js)):
   - Parse the pasted CSV / TSV. Each row is an event.
   - `BEGIN` transaction. Insert into `program_weeks`, then loop and insert each event into `program_roll_events`. Call `setActiveWeek` (writes into `program_active_week`). `COMMIT`.
   - Redirect to `/theprogram/commish` for review.
2. **Load week**: looks the week up, calls `setActiveWeek`. No data is rewritten.
3. **Run the show** (`/theprogram/show`):
   - On first load, the conference-order picker is shown. The order is saved into `program_conference_order`.
   - Per-recruit rolls call `/theprogram/show/result` (server endpoint) which executes the roll deterministically server-side and persists the outcome string back into `program_roll_events.outcome`.
   - The same endpoint short-circuits with `{already_rolled: true}` when called twice for the same event (idempotency guard so a tab reload can't double-roll).
4. **Edit odds inline**: the edit modal POSTs to `/theprogram/show/edit-event`, which updates the `odds` column and re-derives `eligible` / `normalized` on next read. No second roll is triggered.
5. **Export CSV** at `/theprogram/commish/export` reads `program_roll_events` for the active week and emits a CSV of inputs + outcomes.

---

## 3. Server-side roll logic ([src/lib/server/theprogram/show.js](../src/lib/server/theprogram/show.js))

This is the brain of the show. The relevant entry points:

- `parseOddsPercent(s)` / `parseOddsPairs(s)` — tolerant parsers for the raw odds string (`"Clemson 32%, FSU 21%, …"`). Handles `,;|` separators, optional `%`, fractional inputs.
- `groupEvents(rows, conferenceOrder)` — buckets rows by conference, ordered.
- `commitThreshold(schoolCount)` — tiered eligibility floor:
  | Schools | Threshold |
  | --- | --- |
  | ≤ 3 | 15% |
  | 4 | 12% |
  | 5+ | 10% |
  Clamped to `Math.min(list.length, 5)` so 6-school rolls also use the 10% tier (preventing borderline schools from escaping the 5-cap via the threshold's own cull).
- `computeCommit(group)` — builds the per-school display object: `{school, raw, eligible, normalized}`. Applies the threshold then a top-5 cap (drops everyone strictly below the 5th-place raw). Ties at the boundary all stay.
- `computeSteal(group)` — builds the steal pool. Identifies the committed school, detects late-joiners (`in_original_roll === false`), and sets a `noRealAttempt` flag when no eligible stealer remains (only late-joiners attempted).
- `executeRoll(event)` — picks an outcome using the normalized weights. Solo cases (one eligible school) bypass the random pick. Returns a structured outcome record and the CSV-formatted label.
- `loadEventsForWeek(db, weekId)` — single DB read used by every page that displays the week.

### Outcome routing

- **Commit** — winner drawn from eligible schools weighted by normalized odds. Solo case = deterministic winner.
- **Steal** — four outcomes:
  - *Locked* — committed school is locked from steals; no roll runs.
  - *Stayed* — roll executes, committed school happens to win.
  - *No Real Attempt* — all non-committed schools below threshold; outcome is the same as Stayed but the UI skips the spinner.
  - *Stolen* — non-committed school wins.
- **Auto-commit** — schools with raw odds at or above the auto-commit threshold trigger a megaphone-burst reveal. If exactly one bidder, solo reveal. Multiple bidders trigger a contested second roll with its own spinner.

---

## 4. UI processes

### 4.1 Entry → active week

User pastes a CSV (or uploads), names the week, hits **Start Week**. Server validates, inserts rows transactionally, sets active week, redirects to `/theprogram/commish` for human review before broadcasting `show`.

### 4.2 Commissioner review

The commish table shows every roll-event row for the active week with inline editors for the `odds` column and any other fields. The page is intentionally utilitarian — cream backdrop, no dimensional treatment, focus on data legibility. Hairline pewter column dividers, alternating cream / cream-sunk row backgrounds.

### 4.3 The show

The show page is a state machine with three top-level phases:

1. **Conference-order picker.** Shown only on first entry to a fresh week. Drag-friendly form binds each conference to a 1–5 position; submit writes `program_conference_order` and redirects to the first conference.
2. **Launcher.** Per-conference grid of recruit tiles. Each tile shows player + status. Clicking a tile takes you into the theater for that recruit. Conference jump-pills at the bottom let the commish skip around. A "Finish the Show" button appears when every conference is fully rolled.
3. **Theater.** Per-recruit reveal. Top bar with Return-to-List + the breadcrumb (conference name + `X / Y` progress) + edit pencil. Player name as the secondary headline. Below it, either:
   - the schools grid (pre-roll, locked steal, stayed steal, AC megaphone),
   - or the winner card (commit, AC solo, AC contested, steal-success).

The spinner is a JS-driven RAF loop that decelerates onto the winner's helmet. Confetti is a separate 240-particle canvas burst seeded from the winning school's helmet image. Auto-commit fires 45 megaphone particles before the reveal.

### 4.4 Reveal flourishes

- **Rubber stamps** (`STOLEN`, `LOYAL`, `LOCKED`, `AUTO COMMIT`) — rendered as triple-bordered, transparent-bg blocks with `--stamp-ink: #111111`. Slam in via the `stampIn` action.
- **Winning reveal** — winner card scales to `1.05`, gains an outer 5px gold ring (the only place the "earned" gold appears at full force outside of nav).
- **Helmet trim** ([src/lib/client/theprogram/helmetTrim.js](../src/lib/client/theprogram/helmetTrim.js)) — every helmet `<img>` runs through a Svelte action that loads the PNG into a canvas, scans for the alpha bounding-box, and swaps the `src` to a tightly-cropped data URL. Cached by URL. No recoloring; black helmets stay black.

### 4.5 Persistence + idempotency

- Each roll POSTs to `/theprogram/show/result`. The server checks if the event already has an `outcome` — if so, returns `{already_rolled: true}` and the client reuses the saved outcome instead of re-rolling.
- Edit-modal POSTs go to `/theprogram/show/edit-event`. They update odds and never trigger a re-roll, even if the event has been rolled — the saved outcome stays authoritative.

### 4.6 Accessibility

- WCAG AA across the board. The wheat backdrop was retired in favor of `--cream` partly to make muted labels reach 4.5:1 without needing `--tp-muted` to be uncomfortably dark.
- `prefers-reduced-motion` collapses every animation to `0.01ms`; JS-driven RAF loops (spinner, confetti, megaphones) check `matchMedia` and skip the loop entirely.
- All helmet `<img>` carry `alt=""` because the school name is rendered as a sibling — the image is decorative, the name announces.
- Every reveal stage carries a `role="status" aria-live="polite"` `.sr-only` div with a human-readable announcement.
- Edit modal traps focus, Escape closes, focus returns to the trigger.

---

## 5. Styling system

### 5.1 Tokens ([src/routes/theprogram/+layout.svelte](../src/routes/theprogram/+layout.svelte))

Canonical Vintage Varsity — Crimson on Cream palette. Token names retained for backwards compat; values updated to spec.

| Token | Hex | Role |
| --- | --- | --- |
| `--tp-cream` | `#EFE5D0` | Primary surface, page background |
| `--tp-cream-2` | `#E5DBC4` | Recessed surface (table stripes, input fill) |
| `--tp-cream-mute` | `#D8C8A8` | Desaturated cream — primary-resting button label |
| `--tp-frame` | `#D8D3C7` | Outer chrome (mockup frame) |
| `--tp-navy` | `#B8252C` | Crimson — borders, chrome, primary text emphasis |
| `--tp-navy-dark` | `#7A1820` | Crimson-ink — default body text (no pure black anywhere) |
| `--tp-navy-2` | `#C73238` | Crimson hover |
| `--tp-crimson-wash` | `rgba(122,24,32,0.07)` | Active-card tint |
| `--tp-oxblood` | `#4A0F14` | Primary-resting button, locked accents |
| `--tp-oxblood-wash` | `rgba(74,15,20,0.06)` | Locked-card tint |
| `--tp-gold` | `#D9A441` | Earned accent — inner rules, active nav, winning reveal |
| `--tp-gold-2` | `#B98624` | Darker gold (borders / shadows on gold) |
| `--tp-gold-soft` | `#ECC880` | Light gold (hover variants) |
| `--tp-pewter` | `#BFB8AD` | Trim, dividers, disabled states |
| `--tp-pewter-2` | `#8F8979` | Deeper pewter |
| `--tp-pewter-deep` | `#9A968B` | Tertiary text |

### 5.2 Type stacks

| Token | Family | Use |
| --- | --- | --- |
| `--tp-display` | Alfa Slab One | Hero titles, percentages, armed-button labels |
| `--tp-display-condensed` | Oswald / Bebas Neue | Labels, eyebrows, captions |
| `--tp-body` | Lora | Italic body prose (steal messages, prev-note) |

### 5.3 Components

- **Top bar** — sticky crimson band with the brand mark on the left, nav links on the right. Inactive links cream @ 0.65, active gold. Bottom edge: solid 3px gold rule.
- **Cards** — three states:
  - *Active* (default for pending content): `crimson-wash` bg, 2.5px crimson border, 1px gold inner rule via `::after` at inset 4px.
  - *Default / Completed*: cream surface, 1.5px pewter border, contents at 0.7 opacity, no gold rule.
  - *Locked*: `oxblood-wash` bg, oxblood border, gold rule retreats — the LOCKED rect-stamp does the lift.
  - *Threshold-grayed* (school card only): pewter border, per-child opacity 0.55, helmet greyscale @ 0.35, X-badge stays at full opacity.
  - *Winning reveal* (winner card): outer 5px gold ring, scale 1.05.
- **Buttons** — `tp-pill` system:
  - *Secondary* (default): cream fill, 1px crimson border, crimson text. Hover adds a gold outer outline ring at 2px offset.
  - *Primary armed* (`.tp-pill-gold`): crimson fill, 3px gold border, 3px pewter outer ring via box-shadow, cream text with dimensional shadow stack, widened letter-spacing. The "lights up" moment.
  - *Primary resting* (`.tp-pill-resting`): oxblood fill, pewter ring, `--tp-cream-mute` label. Used for pre-armed states.
  - *Disabled*: pewter border + pewter text on cream. No opacity dimming.
- **Form inputs** (`.tp-field`) — cream-sunk fill, pewter border, crimson-ink text. Focus: crimson border + a 1px gold hairline 2px below (notebook-underline) via offset box-shadow.
- **Stamps** (`.rect-stamp`) — black triple-ring (8px border + 2px outline + 3px inset shadow), transparent background, `--rot: -7deg` rotation. Drop-in via the `stampIn` Svelte action.
- **Tables** (commish) — no wrapper card. Header row in crimson-ink display-condensed caps, 2px crimson bottom border, 1px gold rule 2px below (faked via offset box-shadow on the `th`). Alternating cream / cream-sunk rows, hairline pewter column dividers.

### 5.4 Rules of the system

- No pure black (`#000`) or pure white (`#fff`). Defaults are `--tp-navy-dark` and `--tp-cream`.
- No drop shadows. Only the layered border/outline treatment on dimensional text and the winning-reveal gold ring.
- No decorative gradients. The transparency-checkerboard `repeating-conic-gradient` in config is functional and stays.
- Dimensional text shadow (`text-shadow` stack of fill + inner ring + outer ring) is reserved for **three** places: hero page titles, the armed Roll button label, and the winning-school reveal.
- Gold appears in **two or three** places per screen, never more. Reserved for the active nav item, the armed-button border, the winning ring, and the card inner rules. If it's everywhere, it stops feeling earned.
- ≥ 80% of any screen reads as cream / cream-sunk. Crimson is chrome and borders, not full backgrounds (except the top bar).

---

## 6. Build, deploy, run

- SvelteKit 5 with runes (`$state`, `$derived`, `$effect`, `$props`).
- Server endpoints use `pg` via a `createClient()` helper that opens a fresh connection per request — every server-side caller `.end()`s in `finally`.
- Hosted on Netlify. Build: `npm run build`, publish dir `build`, functions dir `netlify/functions` (esbuild bundler). The GitHub remote was moved to `ridleighton/fantasyfootball` — `git remote set-url origin https://github.com/ridleighton/fantasyfootball.git` after the rename, otherwise Netlify's webhook can stall on the redirected push.

---

## 7. Key files

| Path | Responsibility |
| --- | --- |
| [src/routes/theprogram/+layout.svelte](../src/routes/theprogram/+layout.svelte) | `.tp-app` wrapper, tokens, top bar, global theme, pill system, sr-only, prefers-reduced-motion |
| [src/routes/theprogram/+page.svelte](../src/routes/theprogram/+page.svelte) | Entry — start-week form + load-week |
| [src/routes/theprogram/+page.server.js](../src/routes/theprogram/+page.server.js) | `startWeek` (CSV parse + transactional insert) + `loadWeek` |
| [src/routes/theprogram/show/+page.svelte](../src/routes/theprogram/show/+page.svelte) | The show — order picker, launcher, theater, all reveal CSS (~2200 lines) |
| [src/routes/theprogram/show/result/+server.js](../src/routes/theprogram/show/result/+server.js) | Roll endpoint with idempotent `already_rolled` short-circuit |
| [src/routes/theprogram/show/edit-event/+server.js](../src/routes/theprogram/show/edit-event/+server.js) | Inline odds editor |
| [src/routes/theprogram/commish/+page.svelte](../src/routes/theprogram/commish/+page.svelte) | Table + exports |
| [src/routes/theprogram/config/+page.svelte](../src/routes/theprogram/config/+page.svelte) | Asset config — conferences, schools, photos |
| [src/lib/server/theprogram/show.js](../src/lib/server/theprogram/show.js) | `computeCommit`, `computeSteal`, `executeRoll`, thresholds, parsing |
| [src/lib/server/theprogram/active-week.js](../src/lib/server/theprogram/active-week.js) | `setActiveWeek`, `getActiveWeek` |
| [src/lib/client/theprogram/confetti.js](../src/lib/client/theprogram/confetti.js) | 240-particle helmet burst, team-color k-means, CORS-fallback canvas preload |
| [src/lib/client/theprogram/helmetTrim.js](../src/lib/client/theprogram/helmetTrim.js) | Per-`<img>` alpha-bbox crop action |
| [docs/theprogram-design-system.md](theprogram-design-system.md) | Earlier design-system reference (covers the pre-cream / wheat era — use this doc as the current truth) |
| [_design-backups/2026-05-26-pre-wheat/](../_design-backups/2026-05-26-pre-wheat/) | Snapshot of the styled files immediately before the cream refit |
