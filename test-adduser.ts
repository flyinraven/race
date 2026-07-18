import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting test-adduser...");
  try {
    const res = await supabase.from('profiles').insert([{
        id: "a26848eb-633e-4574-92e5-2b8d66cb3674",
        email: "test@example.com",
        firstName: "Test",
        lastName: "Last",
        role: "student",
        tier: "free",
        joined: new Date().toISOString()
    }]);
    console.log("Res:", res);
    if (res.error) {
        console.log("Error object details:", res.error);
        if (res.error.message.includes("row-level security")) {
            console.log("RLS matched.");
        } else {
            console.log("NO RLS Match.");
            console.log(res.error.message);
        }
    }
  } catch(e: any) {
    console.error("Crash:", e.message);
  }
}
test();
