/**
 * Authentication helper for Netlify Functions
 * Validates Bearer tokens and extracts user ID
 */

/**
 * Extract and validate user ID from Authorization header
 * @param {Object} event - Netlify function event object
 * @returns {number|null} - User ID if valid, null otherwise
 */
function getUserIdFromToken(event) {
  try {
    // Get token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode token (simplified - format is base64(userId:timestamp))
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const userId = parseInt(decoded.split(':')[0]);

    if (isNaN(userId)) {
      return null;
    }

    return userId;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

/**
 * Send unauthorized response
 * @returns {Object} - Netlify function response object
 */
function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      error: 'Unauthorized',
      message: 'Valid authentication token required'
    })
  };
}

module.exports = {
  getUserIdFromToken,
  unauthorizedResponse
};
