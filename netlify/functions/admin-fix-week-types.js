const { createClient } = require('./db');
const { getUserIdFromToken } = require('./auth-helper');

/**
 * POST /api/admin/fix-week-types
 * One-time fix for week_type values that are numeric instead of text
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check authentication
    const userId = getUserIdFromToken(event);
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const db = await createClient();

    // Check if user is admin
    const adminCheck = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      await db.end();
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Admin access required' })
      };
    }

    console.log('[Fix Week Types] Starting fix...');

    // Check current state
    const beforeResult = await db.query(`
      SELECT week_type, COUNT(*) as count
      FROM games
      GROUP BY week_type
      ORDER BY week_type
    `);

    console.log('[Fix Week Types] Before:', beforeResult.rows);

    // Fix numeric week_types to 'regular'
    const updateResult = await db.query(`
      UPDATE games
      SET week_type = 'regular'
      WHERE week_type IN ('1', '2', '3')
        AND week_number BETWEEN 1 AND 18
    `);

    console.log(`[Fix Week Types] Updated ${updateResult.rowCount} rows`);

    // Check after state
    const afterResult = await db.query(`
      SELECT week_type, COUNT(*) as count
      FROM games
      GROUP BY week_type
      ORDER BY week_type
    `);

    console.log('[Fix Week Types] After:', afterResult.rows);

    await db.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Week types fixed successfully',
        rowsUpdated: updateResult.rowCount,
        before: beforeResult.rows,
        after: afterResult.rows
      })
    };

  } catch (error) {
    console.error('[Fix Week Types] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
