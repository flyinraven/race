import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFull() {
    console.log("Testing complete signup flow...");
    const email = `test-${Date.now()}@test.com`;
    const password = 'password123';
    try {
        const signupPromise = supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    firstName: "A",
                    lastName: "B",
                    plan: "free"
                }
            }
        });
        signupPromise.catch(() => {});

        const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
            setTimeout(() => reject(new Error('Supabase Auth timed out.')), 15000)
        );
        timeoutPromise.catch(() => {});

        console.log("RACING...");
        const { data, error } = await Promise.race([signupPromise, timeoutPromise]);
        console.log("RACE FINISHED! error:", error, "data:", !!data);
    } catch(e: any) {
        console.error("Crash during race:", e.message);
    }
}

testFull();
