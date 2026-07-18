import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDupe() {
    console.log("Testing dupe flow...");
    const email = `admin@txglobal.com.au`; // known existing
    const password = 'password123';
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        console.log("Dupe signup finished! error:", error, "data.user:", !!data?.user);
        console.log("details:", JSON.stringify({ data, error }, null, 2));
    } catch(e: any) {
        console.error("Crash:", e.message);
    }
    process.exit(0);
}

testDupe();
