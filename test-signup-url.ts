import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting signup test...");
  try {
    const res = await supabase.auth.signUp({
      email: `test-${Date.now()}@test.com`,
      password: 'password123',
      options: {
        emailRedirectTo: 'https://ais-dev-xd7ll35im6j56bedt6esup-364959208208.asia-east1.run.app/dashboard'
      }
    });
    console.log("Signup finished:", res);
  } catch(e) {
    console.error("Crash:", e);
  }
}
test();
