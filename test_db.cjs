const { Client } = require('pg');
async function test() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL");
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), current_user;');
    console.log("Connected!", res.rows);
    await client.end();
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
