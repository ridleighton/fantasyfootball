/**
 * Database connection helper for Netlify Functions
 * Uses pg (PostgreSQL) to connect to Neon database
 */

const { Client } = require('pg');

/**
 * Create a database client
 * @returns {Promise<Client>} Connected PostgreSQL client
 */
async function createClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();
  return client;
}

module.exports = { createClient };
