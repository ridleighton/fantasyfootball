# Pre-Wheat Backup — 2026-05-26

Snapshot of the five styled `/theprogram` files immediately before the wheat-backdrop refactor. Taken at commit `c13293f` (the backdrop variant picker with the light-theme inversion at `data-light="1"`).

Restore one file by copying it back into `src/routes/theprogram/…`. Restore everything by `cp -r theprogram/* ../../../src/routes/theprogram/`.

Files captured:
- `theprogram/+layout.svelte` — tokens, picker UI, variant CSS, dark/light inversion
- `theprogram/+page.svelte` — entry page (dark crimson backdrop + stripes)
- `theprogram/show/+page.svelte` — show page (theater + launcher + stage backdrops + stripes + reveal animations)
- `theprogram/commish/+page.svelte` — commish view styles
- `theprogram/config/+page.svelte` — config page styles
