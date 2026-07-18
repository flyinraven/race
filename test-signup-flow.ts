import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFlow() {
    const email = 'test-flow-' + Date.now() + '@test.com';
    const password = 'password123';
    
    console.log("1. getUsers");
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        console.log("getUsers done. data length:", data?.length, "error:", error?.message);
    } catch (e: any) {
        console.log("getUsers catch:", e.message);
    }

    console.log("2. signUp");
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
        
        const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), 5000)
        );
        
        const {data, error} = await Promise.race([signupPromise, timeoutPromise]);
        console.log("signUp done. user:", !!data?.user, "error:", error?.message);
    } catch (e: any) {
        console.log("signUp catch:", e.message);
    }

    console.log("3. addUser");
    try {
        const { error } = await supabase.from('profiles').insert([{
            id: '12345678-1234-1234-1234-123456789012',
            email,
            firstName: "A",
            lastName: "B",
            role: "student",
            tier: "free",
            joined: "2026-05-17"
        }]);
        console.log("addUser done. error:", error?.message);
    } catch (e: any) {
        console.log("addUser catch:", e.message);
    }
}
testFlow();
