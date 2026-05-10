const pg = require('pg');
const { Client } = pg;

async function createClient() {
  const url = process.env.DATABASE_URL ?? '';
  const connectionString = url.includes('sslmode') ? url : `${url}?sslmode=require`;
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

module.exports = { createClient };
