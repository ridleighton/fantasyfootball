<script>
  let { timeLimit, running, onExpire, onTick } = $props();

  let elapsed = $state(0);

  // Reset when timeLimit changes (new game)
  $effect(() => {
    timeLimit; // track
    elapsed = 0;
  });

  const hasLimit = $derived(timeLimit > 0);

  // Tick up while running
  $effect(() => {
    if (!running) return;

    const id = setInterval(() => {
      elapsed += 1;
      onTick?.(elapsed);
      if (hasLimit && elapsed >= timeLimit) {
        clearInterval(id);
        onExpire?.(elapsed);
      }
    }, 1000);

    return () => clearInterval(id);
  });

  const mins = $derived(Math.floor(elapsed / 60));
  const secs = $derived(elapsed % 60);
  const display = $derived(
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  );
  // Urgent only when a limit exists and we're in the final 30 seconds
  const urgent = $derived(hasLimit && elapsed >= timeLimit - 30 && elapsed < timeLimit);
</script>

<div class="timer" class:urgent>
  {display}
</div>

<style>
  .timer {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--ink);
    transition: color 0.3s;
  }

  .timer.urgent {
    color: var(--bad);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }
</style>
