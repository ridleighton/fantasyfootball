<script>
  let { slot, found, revealed, playerName } = $props();
</script>

<div
  class="slot-card"
  class:found
  class:revealed={revealed && !found}
>
  {#if found}
    <div class="slot-name found-name">{playerName}</div>
  {:else if revealed}
    <div class="slot-name revealed-name">?</div>
    <div class="hint-list">
      {#each Object.entries(slot.hintData ?? {}) as [key, val]}
        <div class="hint-row">
          <span class="hint-key">{key}</span>
          <span class="hint-val">{Array.isArray(val) ? val.join(', ') : val}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="hint-list">
      {#each Object.entries(slot.hintData ?? {}) as [key, val]}
        <div class="hint-row">
          <span class="hint-key">{key}</span>
          <span class="hint-val">{Array.isArray(val) ? val.join(', ') : val}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .slot-card {
    background: var(--card);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    padding: 14px 12px;
    min-width: 140px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }

  .slot-card.found {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--card));
    animation: pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .slot-card.revealed {
    border-color: var(--line);
    background: var(--bg-2);
    opacity: 0.75;
  }

  @keyframes pop-in {
    from { transform: scale(0.85); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }

  .slot-name {
    font-weight: 700;
    font-size: 15px;
    line-height: 1.2;
  }

  .found-name {
    color: var(--accent);
  }

  .revealed-name {
    color: var(--ink-soft);
    font-size: 20px;
    text-align: center;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hint-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hint-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: baseline;
  }

  .hint-key {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-soft);
    flex-shrink: 0;
  }

  .hint-val {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
    word-break: break-word;
  }
</style>
