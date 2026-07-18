import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting bad-url test...");
  try {
    const res = await supabase.auth.signUp({
      email: `test-bad-url-${Date.now()}@test.com`,
      password: 'password123',
      options: {
        emailRedirectTo: 'https://completely-unregistered-domain.com/dashboard'
      }
    });
    console.log("Signup returned:", JSON.stringify(res, null, 2));
  } catch(e) {
    console.error("Crash:", e);
  }
}
test();
