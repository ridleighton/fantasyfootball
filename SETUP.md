# down bad ↓ — Setup Guide

## Prerequisites
- Node 18+
- Neon Postgres database (existing)
- Supabase project (newly created)
- Netlify account

---

## 1. Supabase project

Go to your [Supabase dashboard](https://supabase.com/dashboard) and open your project.

You'll need three values from **Project Settings → API**:
| What | Supabase label | Env var name in this app |
|------|---------------|--------------------------|
| Project URL | `URL` | `PUBLIC_SUPABASE_URL` |
| Anon / public key | `anon public` | `PUBLIC_SUPABASE_ANON_KEY` |
| Service role key | `service_role secret` | `SUPABASE_SERVICE_ROLE_KEY` |

> **Note:** If you already set env vars in Netlify with different names (e.g. `SUPABASE_APIKEY`, `SUPABASE_SECRET`), either rename them in the Netlify UI to match the names above, or update `src/lib/server/auth.js` to import from the names you used.

---

## 2. Local development

```bash
cp .env.example .env
# Fill in .env with your real values
npm install
```

**Run the DB schema migration** (adds `supabase_uid`, `is_commissioner`, renames `espn_game_id`):
```bash
node scripts/migrate-schema.js
```

**Create Supabase accounts for existing users:**
```bash
node scripts/migrate-users.js
```
This prints a temp password for each user. Share securely or trigger password-reset emails.

**Start dev server:**
```bash
npm run dev
```

---

## 3. Netlify deployment

In **Netlify → Site settings → Environment variables**, add:

```
PUBLIC_SUPABASE_URL        = https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY  = eyJ...
DATABASE_URL               = postgresql://...  (already set)
SPORTSIO_APIKEY            = ...               (already set as SPORTSIO_APIKEY)
```

Deploy via git push or `netlify deploy --prod`.

---

## 4. Supabase Auth settings

In **Supabase → Authentication → URL Configuration**:
- **Site URL**: `https://your-netlify-site.netlify.app`
- **Redirect URLs**: `https://your-netlify-site.netlify.app/auth/callback`

For local dev add `http://localhost:5173/auth/callback` too.

---

## 5. Scheduled game sync

The two scheduled Netlify Functions remain unchanged:
- `netlify/functions/scheduled-game-sync.js` — syncs live scores
- `netlify/functions/scheduled-weekly-sync.js` — syncs new week's schedule

These still use the old ESPN API. To switch them to the new SvelteKit sync endpoint, POST to `/api/admin/sync/games` instead.

---

## 6. Making a user an admin

```sql
UPDATE users SET is_admin = true WHERE username = 'your@email.com';
```

Or for commissioner access (can sync games, view admin panel):
```sql
UPDATE users SET is_commissioner = true WHERE username = 'your@email.com';
```
