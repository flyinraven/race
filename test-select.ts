import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting select test...");
  try {
    const res = await supabase.from('profiles').select('*');
    console.log("Select finished:", JSON.stringify(res, null, 2));
  } catch(e) {
    console.error("Crash:", e);
  }
}
test();
