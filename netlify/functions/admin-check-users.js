const { createClient } = require('./db');

/**
 * ADMIN UTILITY FUNCTION
 * GET /api/admin/check-users
 *
 * Lists all users in the database (without sensitive data)
 * Useful for debugging login issues
 */
exports.handler = async (event, context) => {
  try {
    const db = await createClient();

    const result = await db.query(`
      SELECT id, username, display_name, is_admin, created_at
      FROM users
      ORDER BY id
    `);

    await db.end();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        users: result.rows
      })
    };

  } catch (error) {
    console.error('Error checking users:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to check users',
        message: error.message
      })
    };
  }
};
