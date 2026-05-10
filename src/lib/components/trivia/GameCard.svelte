<script>
  let { game } = $props();

  const truncatedPrompt = $derived(
    game.prompt.length > 100
      ? game.prompt.slice(0, 97) + '…'
      : game.prompt
  );

  const timeDisplay = $derived(
    (() => {
      const m = Math.floor(game.time_limit_seconds / 60);
      const s = game.time_limit_seconds % 60;
      return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`;
    })()
  );
</script>

<a href="/trivia/{game.slug}" class="db-card game-card">
  <div class="card-top">
    <div class="card-meta">
      {#each (game.databases ?? []) as db}
        <span class="db-pill">{db}</span>
      {/each}
    </div>
    <span class="time-badge">{timeDisplay}</span>
  </div>

  <h3 class="game-title">{game.title}</h3>
  <p class="game-prompt">{truncatedPrompt}</p>

  <div class="card-footer">
    <span class="answer-count">{game.answer_count} answer{game.answer_count !== 1 ? 's' : ''}</span>
    <span class="play-link">Play →</span>
  </div>
</a>

<style>
  .game-card {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 20px;
    border-radius: 14px;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  }

  .game-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .card-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .time-badge {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    background: var(--bg-2);
    padding: 3px 8px;
    border-radius: 6px;
    color: var(--ink-soft);
    border: 1px solid var(--line);
    flex-shrink: 0;
  }

  .game-title {
    font-size: 18px;
    font-weight: 800;
    margin: 0 0 6px;
    line-height: 1.2;
    color: var(--ink);
  }

  .game-prompt {
    font-size: 13px;
    color: var(--ink-soft);
    margin: 0 0 14px;
    line-height: 1.4;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .answer-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-soft);
  }

  .play-link {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
</style>
