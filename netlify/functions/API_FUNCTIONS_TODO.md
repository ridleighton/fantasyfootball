# API Functions Implementation Status

## ✅ Completed Functions

### Authentication
- ✅ `auth-login.js` - POST /api/auth/login
- ✅ `auth-validate.js` - GET /api/auth/validate

### Picks
- ✅ `picks-compare-week.js` - GET /api/picks/compare-week

## 🔄 Required Functions (To Be Implemented)

### Authentication (Remaining)
- ❌ `auth-logout.js` - POST /api/auth/logout
- ❌ `auth-change-password.js` - POST /api/auth/change-password

### Users
- ❌ `users-profile.js` - GET /api/users/profile
- ❌ `users-update-profile.js` - PUT /api/users/profile
- ❌ `users-list.js` - GET /api/users

### Games
- ❌ `games-current-week.js` - GET /api/games/current-week
- ❌ `games-get.js` - GET /api/games?week={n}&year={y}
- ❌ `games-weeks.js` - GET /api/games/weeks

### Picks (Remaining)
- ❌ `picks-get.js` - GET /api/picks?week={n}&year={y}&leagueId={id}
- ❌ `picks-submit.js` - POST /api/picks
- ❌ `picks-all-for-game.js` - GET /api/picks/all?gameId={id}
- ❌ `picks-user.js` - GET /api/picks/user/{userId}?week={n}&leagueId={id}

### Leaderboard
- ❌ `leaderboard-season.js` - GET /api/leaderboard/season?leagueId={id}
- ❌ `leaderboard-week.js` - GET /api/leaderboard/week?week={n}&leagueId={id}

### Stats
- ❌ `stats-user.js` - GET /api/stats/user/{userId}?leagueId={id}
- ❌ `stats-league.js` - GET /api/stats/league/{leagueId}

### Admin
- ❌ `admin-users-create.js` - POST /api/admin/users
- ❌ `admin-users-update.js` - PUT /api/admin/users/{userId}
- ❌ `admin-users-delete.js` - DELETE /api/admin/users/{userId}
- ❌ `admin-users-reset-password.js` - POST /api/admin/users/{userId}/reset-password
- ❌ `admin-games-sync.js` - POST /api/admin/games/sync
- ❌ `admin-games-update.js` - PUT /api/admin/games/{gameId}
- ❌ `admin-games-toggle-override.js` - PUT /api/admin/games/{gameId}/override
- ❌ `admin-leagues-create.js` - POST /api/admin/leagues
- ❌ `admin-leagues-list.js` - GET /api/admin/leagues
- ❌ `admin-leagues-add-member.js` - POST /api/admin/leagues/{leagueId}/members
- ❌ `admin-leagues-remove-member.js` - DELETE /api/admin/leagues/{leagueId}/members/{userId}
- ❌ `admin-export-picks.js` - GET /api/admin/export/picks?leagueId={id}

## 📝 Implementation Notes

### Function Naming Convention
Netlify functions should be named with hyphens (kebab-case):
- File: `auth-login.js`
- Route: `/api/auth/login` (via netlify.toml redirect)

### Database Connection
All functions use `@netlify/neon` for database access:
```javascript
const { createClient } = require('@netlify/neon');
const db = createClient(process.env.DATABASE_URL);
```

### Authentication Middleware
Most endpoints need authentication. Check for Bearer token:
```javascript
const authHeader = event.headers.authorization || event.headers.Authorization;
const token = authHeader.substring(7); // Remove 'Bearer '
```

### Response Format
Standard response structure:
```javascript
{
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: { /* response data */ },
    message: 'Success message'
  })
}
```

### Error Handling
Always wrap in try-catch:
```javascript
try {
  // Function logic
} catch (error) {
  console.error('Error:', error);
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Internal server error',
      message: error.message
    })
  };
}
```

## 🚀 Quick Start

### Option 1: Use the Comparison Feature (Already Works!)
The comparison view is fully functional once you have:
1. Auth working (✅ done)
2. Games data in database
3. Picks data in database

### Option 2: Implement Core Functions First
Priority order for basic functionality:
1. ✅ auth-login.js (done)
2. ✅ auth-validate.js (done)
3. games-current-week.js (needed for picks page)
4. games-get.js (needed for history)
5. picks-get.js (needed for viewing picks)
6. picks-submit.js (needed for making picks)
7. leaderboard-week.js (needed for home page)

### Option 3: Use Netlify Dev for Local Testing
```bash
npm run dev
# Visit http://localhost:8888
```

## 📦 Dependencies

Already installed in package.json:
- `@netlify/neon` - Database client
- `bcrypt` - Password hashing
- `pg` - PostgreSQL driver

## 🔐 Environment Variables

Required in Netlify:
- `DATABASE_URL` - Neon PostgreSQL connection string

## 💡 Tips

1. **Start with mock data**: Create functions that return hardcoded data first
2. **Test locally**: Use `netlify dev` to test functions locally
3. **Check logs**: Use Netlify function logs to debug issues
4. **Use the comparison function as template**: `picks-compare-week.js` is a good example

## 📚 Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Neon Database Docs](https://neon.tech/docs/introduction)
- Your schema: `/db/schema.sql`
