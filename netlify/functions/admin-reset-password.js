const { createClient } = require('./db');
const bcrypt = require('bcrypt');

/**
 * ADMIN UTILITY FUNCTION
 * POST /api/admin/reset-password
 *
 * Resets a user's password
 * Body: { "username": "admin", "newPassword": "NewPassword123!" }
 *
 * WARNING: This is a security risk in production.
 * Delete this function after fixing your login issue.
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { username, newPassword } = JSON.parse(event.body);

    if (!username || !newPassword) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Username and newPassword are required'
        })
      };
    }

    const db = await createClient();

    // Hash the new password
    const SALT_ROUNDS = 10;
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the password
    const result = await db.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = false
       WHERE username = $2
       RETURNING id, username, display_name`,
      [passwordHash, username]
    );

    await db.end();

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'User not found',
          username
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        user: result.rows[0],
        warning: 'Please delete admin-reset-password.js function for security'
      })
    };

  } catch (error) {
    console.error('Password reset error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Password reset failed',
        message: error.message
      })
    };
  }
};
