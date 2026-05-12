<script>
  let { game, found, total, elapsedSecs = 0, onPlayAgain } = $props();

  const MAX_EMOJI = 15;

  // MM:SS formatter
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // Score: base points per answer, speed bonus applied on top
  // Base: 100 pts per correct answer
  // Speed multiplier: faster = higher. At 0s elapsed = 2×, at timeLimit = 1×, linear.
  const scoreVal = $derived((() => {
    if (found === 0 || elapsedSecs === 0) return found * 100;
    const timeLimit = game.time_limit_seconds;
    const speedMultiplier = timeLimit > 0
      ? 1 + Math.max(0, 1 - elapsedSecs / timeLimit)
      : 1;
    return Math.round(found * 100 * speedMultiplier);
  })());

  const timeStr = $derived(fmtTime(elapsedSecs));

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

  // Detect Web Share API support (mobile native share sheet)
  const canNativeShare = $derived(
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  );

  let shareState = $state('idle'); // 'idle' | 'copied' | 'shared'

  function buildShareText() {
    const timePart = elapsedSecs > 0 ? ` in ${timeStr}` : '';
    const scorePart = ` · ${scoreVal} pts`;
    return `Down Bad Trivia — ${game.title}\n${emojiString}   ${found}/${total}${timePart}${scorePart}\nPlay: ${typeof window !== 'undefined' ? window.location.href : ''}`;
  }

  async function share() {
    const text = buildShareText();

    if (canNativeShare) {
      try {
        await navigator.share({ title: 'Down Bad Trivia', text });
        shareState = 'shared';
        setTimeout(() => { shareState = 'idle'; }, 2000);
      } catch {
        // User cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        shareState = 'copied';
        setTimeout(() => { shareState = 'idle'; }, 2000);
      } catch {
        prompt('Copy your result:', text);
      }
    }
  }

  const shareLabel = $derived(
    shareState === 'copied' ? 'Copied!' :
    shareState === 'shared' ? 'Shared!' :
    canNativeShare ? 'Share' : 'Copy result'
  );
</script>

<div class="results-wrap db-card">
  <p class="score-label db-sub">Your score</p>

  <div class="score-big">
    <span class="score-found">{found}</span>
    <span class="score-sep"> / </span>
    <span class="score-total">{total}</span>
  </div>

  {#if elapsedSecs > 0}
    <div class="time-row">
      <span class="time-icon">⏱</span>
      <span class="time-val">{timeStr}</span>
      <span class="pts-pill">{scoreVal} pts</span>
    </div>
  {/if}

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
    <button class="db-btn primary share-btn" onclick={share}>
      {#if canNativeShare}
        <svg class="share-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M13 7H7v6h6V7z" opacity="0"/>
          <path fill-rule="evenodd" d="M10 2a.75.75 0 01.75.75v7.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V2.75A.75.75 0 0110 2zM4 13a1 1 0 00-1 1v2a1 1 0 001 1h12a1 1 0 001-1v-2a1 1 0 00-1-1h-1.5a.75.75 0 000 1.5H16v1H4v-1h1.5A.75.75 0 005.5 13H4z" clip-rule="evenodd"/>
        </svg>
      {/if}
      {shareLabel}
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
    margin-bottom: 12px;
  }

  .score-found { color: var(--accent); }
  .score-sep { color: var(--ink-soft); font-size: 40px; }
  .score-total { color: var(--ink); }

  .time-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .time-icon { font-size: 16px; }

  .time-val {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.05em;
  }

  .pts-pill {
    font-size: 12px;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-2));
    color: var(--accent);
    letter-spacing: 0.02em;
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

  .share-btn {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .share-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>
