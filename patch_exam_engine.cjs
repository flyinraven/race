const fs = require('fs');
let code = fs.readFileSync('src/services/examEngine.ts', 'utf8');

code = code.replace(/import \{ supabase, isSupabaseConfigured \} from '\.\.\/lib\/supabase';/g, "import { apiFetch } from '../lib/apiClient';");

code = code.replace(/await supabase\.from\('settings'\)\.select\('value'\)\.eq\('id', 'exam_guidelines'\)\.single\(\);/g, "await apiFetch('/settings/exam_guidelines').then(res => ({ data: res, error: null })).catch(err => ({ data: null, error: err }));");

code = code.replace(/await supabase\.from\('settings'\)\.upsert\(\{ id: 'exam_guidelines', value: text \}\);/g, "await apiFetch('/settings', { method: 'POST', body: JSON.stringify({ id: 'exam_guidelines', value: text }) });");

code = code.replace(/await supabase\.from\('settings'\)\.select\('value'\)\.eq\('id', 'curriculum'\)\.single\(\);/g, "await apiFetch('/settings/curriculum').then(res => ({ data: res, error: null })).catch(err => ({ data: null, error: err }));");

code = code.replace(/await supabase\.from\('settings'\)\.upsert\(\{ id: 'curriculum', value: text \}\);/g, "await apiFetch('/settings', { method: 'POST', body: JSON.stringify({ id: 'curriculum', value: text }) });");

code = code.replace(/const \{ data, error \} = await supabase\.from\('questions'\)\.select\('\*'\);/g, "const data = await apiFetch('/questions').catch(() => null); const error = !data ? { message: 'Fetch failed' } : null;");

code = code.replace(/const \{ error \} = await supabase\.from\('questions'\)\.upsert\(cleanBank\);/g, "await apiFetch('/questions/upsert', { method: 'POST', body: JSON.stringify(cleanBank) }); const error = null;");

code = code.replace(/const \{ error \} = await supabase\.from\('questions'\)\.delete\(\)\.in\('id', ids\);/g, "await apiFetch('/questions/delete', { method: 'POST', body: JSON.stringify({ ids }) }); const error = null;");

code = code.replace(/if \(isSupabaseConfigured\) \{/g, "if (true) {");

fs.writeFileSync('src/services/examEngine.ts', code);
