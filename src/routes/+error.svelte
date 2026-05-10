<script>
  import { page } from '$app/stores';
</script>

<div class="db-page" style="display:grid;place-items:center;min-height:60vh">
  <div style="text-align:center">
    <p style="font-size:48px;margin:0 0 12px">👻</p>
    <h1 class="db-h1" style="margin-bottom:8px">{$page.status}</h1>
    <p class="db-sub" style="margin-bottom:24px">{$page.error?.message ?? 'Something went wrong'}</p>
    <a href="/" class="db-btn primary">Go home</a>
  </div>
</div>
