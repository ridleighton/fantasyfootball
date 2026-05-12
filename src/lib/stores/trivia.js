import { writable, derived } from 'svelte/store';

export const slots = writable([]);
export const foundIds = writable(new Set());
export const gameOver = writable(false);
export const playerNames = writable({}); // slotId → playerName, populated after found/reveal

export const progress = derived(
  [slots, foundIds],
  ([$slots, $foundIds]) => ({
    found: $foundIds.size,
    total: $slots.length,
    pct: $slots.length ? ($foundIds.size / $slots.length) * 100 : 0
  })
);
