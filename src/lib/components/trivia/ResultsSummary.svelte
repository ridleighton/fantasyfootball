<script>
  let { game, found, total, onPlayAgain } = $props();

  const MAX_EMOJI = 15;

  const emojiString = $derived(
    (() => {
      const display = Math.min(total, MAX_EMOJI);
      const foundDisplay = Math.min(found, MAX_EMOJI);
      const result = [];
      for (let i = 0; i < display; i++) {
        result.push(i < foundDisplay ? '👻' : '○');
      }
      if (total > MAX_EMOJI) result.push('…');
      return result.join('');
    })()
  );

  let copied = $state(false);

  function share() {
    const text = `Down Bad Trivia — ${game.title}\n${emojiString}   ${found}/${total}`;
    navigator.clipboard.writeText(text).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }).catch(() => {
      // Fallback if clipboard not available
      prompt('Copy your result:', text);
    });
  }
</script>

<div class="results-wrap db-card">
  <p class="score-label db-sub">Your score</p>
  <div class="score-big">
    <span class="score-found">{found}</span>
    <span class="score-sep"> / </span>
    <span class="score-total">{total}</span>
  </div>
  <p class="score-sub">
    {#if found === total}
      Perfect! You got them all.
    {:else if found === 0}
      No worries — better luck next time!
    {:else}
      You found {found} out of {total}.
    {/if}
  </p>

  <div class="emoji-row" title="Your result">{emojiString}</div>

  <div class="result-actions">
    <button class="db-btn primary" onclick={share}>
      {copied ? 'Copied!' : 'Share result'}
    </button>
    {#if onPlayAgain}
      <button class="db-btn" onclick={onPlayAgain}>Browse games</button>
    {:else}
      <a href="/trivia" class="db-btn">Browse games</a>
    {/if}
  </div>
</div>

<style>
  .results-wrap {
    padding: 32px 24px;
    text-align: center;
    max-width: 420px;
    margin: 0 auto;
  }

  .score-label {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    font-weight: 700;
  }

  .score-big {
    font-size: 56px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 8px;
  }

  .score-found {
    color: var(--accent);
  }

  .score-sep {
    color: var(--ink-soft);
    font-size: 40px;
  }

  .score-total {
    color: var(--ink);
  }

  .score-sub {
    font-size: 15px;
    color: var(--ink-soft);
    margin: 0 0 20px;
  }

  .emoji-row {
    font-size: 20px;
    letter-spacing: 2px;
    margin-bottom: 24px;
    word-break: break-all;
    line-height: 1.6;
  }

  .result-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
</style>
