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
      email: `test-signup-${Date.now()}@test.com`,
      password: 'password123',
      options: {
        emailRedirectTo: 'https://completely-unregistered-domain.com/dashboard'
      }
    });
    console.log("Signup returned:", JSON.stringify(res, null, 2));

    if (res.data.user) {
        console.log("Inserting profile...");
        const insertRes = await supabase.from('profiles').insert([{
            id: res.data.user.id,
            email: res.data.user.email,
            firstName: 'Test',
            lastName: 'User',
            role: 'student',
            tier: 'free',
            joined: new Date().toISOString()
        }]);
        console.log("Insert res:", JSON.stringify(insertRes, null, 2));
    }

  } catch(e) {
    console.error("Crash:", e);
  }
}
test();
