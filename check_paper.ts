
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('questions').select('*').eq('paper', 'Paper 1');
  console.log('Paper 1 count:', data?.length);
  
  if (data?.length) {
     const types = {};
     data.forEach(d => {
         types[d.type] = (types[d.type] || 0) + 1;
     });
     console.log(types);
  }
}
check();
