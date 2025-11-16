const { createClient } = require('./db');
const bcrypt = require('bcrypt');

/**
 * ONE-TIME SETUP FUNCTION
 * GET /api/setup/database
 *
 * This function sets up the database schema and creates the initial admin user.
 * It should only be run once when first deploying the application.
 *
 * WARNING: This endpoint should be deleted after initial setup for security.
 */
exports.handler = async (event, context) => {
  try {
    const db = await createClient();

    // Create tables from schema
    console.log('Creating database schema...');

    await db.query(`
      -- Users table with custom colors
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          timezone VARCHAR(50) DEFAULT 'America/New_York',
          primary_color VARCHAR(7) DEFAULT '#8AB4F8',
          secondary_color VARCHAR(7) DEFAULT '#5E97F6',
          is_admin BOOLEAN DEFAULT FALSE,
          must_change_password BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Leagues for multi-league support
      CREATE TABLE IF NOT EXISTS leagues (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          season_year INTEGER NOT NULL,
          mode VARCHAR(20) DEFAULT 'standard',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- League membership
      CREATE TABLE IF NOT EXISTS league_members (
          id SERIAL PRIMARY KEY,
          league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(league_id, user_id)
      );

      -- Games table with sync override
      CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          espn_game_id VARCHAR(50) UNIQUE NOT NULL,
          season_year INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          week_type VARCHAR(20) NOT NULL,
          home_team VARCHAR(100) NOT NULL,
          away_team VARCHAR(100) NOT NULL,
          home_team_abbr VARCHAR(10),
          away_team_abbr VARCHAR(10),
          home_team_logo VARCHAR(255),
          away_team_logo VARCHAR(255),
          game_time TIMESTAMP NOT NULL,
          home_score INTEGER,
          away_score INTEGER,
          game_status VARCHAR(20) NOT NULL,
          winner VARCHAR(50),
          sync_override BOOLEAN DEFAULT FALSE,
          last_synced_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Picks table (standard pick'ems)
      CREATE TABLE IF NOT EXISTS picks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
          league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
          predicted_winner VARCHAR(50) NOT NULL,
          is_correct BOOLEAN,
          picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, game_id, league_id)
      );

      -- Confidence picks (for future confidence pool mode)
      CREATE TABLE IF NOT EXISTS confidence_picks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
          league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
          predicted_winner VARCHAR(50) NOT NULL,
          confidence_value INTEGER NOT NULL,
          points_earned INTEGER DEFAULT 0,
          is_correct BOOLEAN,
          picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, game_id, league_id)
      );

      -- Sessions for authentication
      CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Admin activity log
      CREATE TABLE IF NOT EXISTS admin_logs (
          id SERIAL PRIMARY KEY,
          admin_user_id INTEGER REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_games_week ON games(season_year, week_number);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(game_status);
      CREATE INDEX IF NOT EXISTS idx_picks_user_league ON picks(user_id, league_id);
      CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_league_members ON league_members(league_id, user_id);
    `);

    console.log('✅ Database schema created');

    // Create admin user
    const SALT_ROUNDS = 10;
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    const adminResult = await db.query(
      `INSERT INTO users (username, display_name, password_hash, timezone, primary_color, secondary_color, is_admin, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [
        process.env.ADMIN_USERNAME || 'admin',
        process.env.ADMIN_DISPLAY_NAME || 'Administrator',
        adminPasswordHash,
        process.env.ADMIN_TIMEZONE || 'America/New_York',
        process.env.ADMIN_PRIMARY_COLOR || '#8AB4F8',
        process.env.ADMIN_SECONDARY_COLOR || '#5E97F6'
      ]
    );

    const adminId = adminResult.rows[0].id;
    console.log('✅ Admin user created/updated');

    // Create default league
    const currentSeason = parseInt(process.env.CURRENT_SEASON) || new Date().getFullYear();
    const leagueResult = await db.query(
      `INSERT INTO leagues (name, season_year, mode, created_by)
       VALUES ($1, $2, 'standard', $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['Main League', currentSeason, adminId]
    );

    let leagueId;
    if (leagueResult.rows.length > 0) {
      leagueId = leagueResult.rows[0].id;
      console.log('✅ Default league created');
    } else {
      // League already exists, fetch it
      const existingLeague = await db.query(
        `SELECT id FROM leagues WHERE name = 'Main League' AND season_year = $1`,
        [currentSeason]
      );
      leagueId = existingLeague.rows[0]?.id;
      console.log('ℹ️  League already exists');
    }

    // Add admin to league
    if (leagueId) {
      await db.query(
        `INSERT INTO league_members (league_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [leagueId, adminId]
      );
      console.log('✅ Admin added to league');
    }

    await db.end();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database setup completed successfully!',
        data: {
          adminUsername: process.env.ADMIN_USERNAME || 'admin',
          defaultPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
          leagueName: 'Main League',
          seasonYear: currentSeason,
          warning: 'Please delete this function (setup-database.js) for security after setup is complete.'
        }
      })
    };

  } catch (error) {
    console.error('Setup error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Database setup failed',
        message: error.message,
        details: error.stack
      })
    };
  }
};
