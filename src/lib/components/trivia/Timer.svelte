<script>
  let { seconds, running, onExpire } = $props();

  let current = $state(seconds);

  // When the seconds prop changes (e.g., reset), sync current
  $effect(() => {
    current = seconds;
  });

  // Tick down while running
  $effect(() => {
    if (!running || current <= 0) return;

    const id = setInterval(() => {
      if (current <= 1) {
        current = 0;
        clearInterval(id);
        onExpire?.();
      } else {
        current -= 1;
      }
    }, 1000);

    return () => clearInterval(id);
  });

  const mins = $derived(Math.floor(current / 60));
  const secs = $derived(current % 60);
  const display = $derived(
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  );
  const urgent = $derived(current <= 30 && current > 0);
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
