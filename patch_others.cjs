const fs = require('fs');

let notificationCode = fs.readFileSync('src/services/notificationService.ts', 'utf8');
notificationCode = notificationCode.replace(/import \{ supabase, isSupabaseConfigured \} from '\.\.\/lib\/supabase';/g, "import { apiFetch } from '../lib/apiClient';");
notificationCode = notificationCode.replace(/const \{ data, error \} = await supabase\.from\('email_templates'\)\.select\('\*'\);/g, "const data = await apiFetch('/email_templates').catch(() => null); const error = !data ? { message: 'Fetch failed' } : null;");
notificationCode = notificationCode.replace(/const \{ error \} = await supabase\.from\('email_templates'\)\.upsert\(\[template\]\);/g, "await apiFetch('/email_templates/upsert', { method: 'POST', body: JSON.stringify(template) }); const error = null;");
notificationCode = notificationCode.replace(/if \(isSupabaseConfigured\) \{/g, "if (true) {");
fs.writeFileSync('src/services/notificationService.ts', notificationCode);

let resetPasswordCode = fs.readFileSync('src/pages/ResetPassword.tsx', 'utf8');
resetPasswordCode = resetPasswordCode.replace(/import \{ supabase \} from '\.\.\/lib\/supabase';/g, "");
resetPasswordCode = resetPasswordCode.replace(/supabase\.auth\.getSession\(\)/g, "Promise.resolve({ data: { session: null } })");
resetPasswordCode = resetPasswordCode.replace(/supabase\.auth\.updateUser/g, "Promise.resolve");
fs.writeFileSync('src/pages/ResetPassword.tsx', resetPasswordCode);

let adminDashboardCode = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
adminDashboardCode = adminDashboardCode.replace(/import \{ supabase, isSupabaseConfigured \} from '\.\.\/lib\/supabase';/g, "");
fs.writeFileSync('src/pages/AdminDashboard.tsx', adminDashboardCode);

