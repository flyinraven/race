const { Client } = require('pg');
async function test() {
  // Try pooler with project id in username
  const url = "postgresql://postgres.pjqdnxxlpnghbknmrkho:Raceexam2026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT count(*) FROM information_schema.tables;');
    console.log("Connected to Supabase Pooler! Tables:", res.rows[0].count);
    await client.end();
  } catch (e) {
    console.log("Supabase Error:", e.message);
  }
}
test();
