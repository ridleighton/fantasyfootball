<script>
  let { disabled = false, onGuess, shake = false } = $props();

  let value = $state('');
  let shaking = $state(false);

  $effect(() => {
    if (shake) {
      shaking = true;
      const t = setTimeout(() => { shaking = false; }, 600);
      return () => clearTimeout(t);
    }
  });

  function handleKeydown(e) {
    if (e.key === 'Enter' && !disabled) {
      const trimmed = value.trim();
      if (trimmed) {
        onGuess?.(trimmed);
        value = '';
      }
    }
  }
</script>

<div class="input-wrap" class:shake={shaking}>
  <input
    class="db-input answer-input"
    type="text"
    bind:value
    onkeydown={handleKeydown}
    {disabled}
    placeholder={disabled ? "Time's up!" : 'Type a name…'}
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
    autofocus
  />
</div>

<style>
  .input-wrap {
    width: 100%;
  }

  .answer-input {
    width: 100%;
    font-size: 20px;
    font-weight: 600;
    padding: 14px 18px;
    border-radius: 12px;
    box-sizing: border-box;
  }

  .answer-input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    15%       { transform: translateX(-8px); }
    30%       { transform: translateX(8px); }
    45%       { transform: translateX(-6px); }
    60%       { transform: translateX(6px); }
    75%       { transform: translateX(-3px); }
    90%       { transform: translateX(3px); }
  }

  .shake {
    animation: shake 0.6s ease-in-out;
  }
</style>
