import pg from 'pg';
const { Client } = pg;

export async function createClient() {
  const url = process.env.DATABASE_URL ?? '';
  const connectionString = url.includes('sslmode') ? url : `${url}?sslmode=require`;
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}
