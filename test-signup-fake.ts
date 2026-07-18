import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting duplicate signup test...");
  try {
    const res = await supabase.auth.signUp({
      email: `test-fake-success@test.com`,
      password: 'password123'
    });
    console.log("First Signup finished:", JSON.stringify(res, null, 2));

    const res2 = await supabase.auth.signUp({
      email: `test-fake-success@test.com`,
      password: 'password123'
    });
    console.log("Second Signup finished:", JSON.stringify(res2, null, 2));

  } catch(e) {
    console.error("Crash:", e);
  }
}
test();
