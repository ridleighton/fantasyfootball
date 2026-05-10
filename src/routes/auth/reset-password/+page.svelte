<script>
  import { createSupabaseBrowserClient } from '$lib/supabase.js';
  import { goto } from '$app/navigation';

  let { data } = $props();
  const supabase = createSupabaseBrowserClient(data.supabase.url, data.supabase.anonKey);
  const linkError = data.linkError;

  let password = $state('');
  let confirm = $state('');
  let error = $state('');
  let loading = $state(false);
  let done = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { error = 'Passwords do not match'; return; }
    if (password.length < 8) { error = 'Password must be at least 8 characters'; return; }
    error = '';
    loading = true;
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      done = true;
      setTimeout(() => goto('/'), 2000);
    } catch (err) {
      error = err.message ?? 'Failed to update password';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Set password · down bad ↓</title></svelte:head>

<div style="min-height:100vh;display:grid;place-items:center;background:var(--bg);padding:24px">
  <div style="width:100%;max-width:380px">
    <div style="text-align:center;margin-bottom:32px">
      <div class="db-brand-mark" style="width:56px;height:56px;font-size:28px;margin:0 auto 12px">👻</div>
      <h1 style="font-size:28px;font-weight:800;font-style:italic;letter-spacing:-.025em;margin:0 0 4px">down bad ↓</h1>
      <p class="db-sub">set a new password</p>
    </div>

    <div class="db-card" style="padding:24px">
      {#if linkError}
        <div style="color:var(--bad);font-size:14px;font-weight:600;text-align:center;margin-bottom:16px">
          {linkError}
        </div>
        <a href="/auth/login" class="db-btn primary lg" style="width:100%;justify-content:center;text-decoration:none;display:flex">
          Back to login →
        </a>
      {:else if done}
        <p style="color:var(--good);font-weight:700;text-align:center">Password updated! Redirecting…</p>
      {:else}
        <form onsubmit={handleSubmit}>
          <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true" />
          <div style="margin-bottom:14px">
            <label class="db-label" for="password">New password</label>
            <input id="password" type="password" class="db-input" placeholder="••••••••"
              bind:value={password} required minlength="8" autocomplete="new-password" />
          </div>
          <div style="margin-bottom:16px">
            <label class="db-label" for="confirm">Confirm password</label>
            <input id="confirm" type="password" class="db-input" placeholder="••••••••"
              bind:value={confirm} required autocomplete="new-password" />
          </div>

          {#if error}
            <div style="color:var(--bad);font-size:13px;font-weight:600;margin-bottom:12px;
                        padding:10px 14px;background:var(--bg-2);border-radius:8px;border:1px solid var(--bad)">
              {error}
            </div>
          {/if}

          <button type="submit" class="db-btn primary lg" style="width:100%;justify-content:center" disabled={loading}>
            {loading ? 'Saving…' : 'Set password →'}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
