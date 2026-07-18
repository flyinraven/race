
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('questions').select('paper, type, questionLabel');
  if (data?.length) {
     const counts = {};
     data.forEach(d => {
         counts[d.paper] = (counts[d.paper] || 0) + 1;
     });
     console.log('Papers in DB:', counts);
  }
}
check();
