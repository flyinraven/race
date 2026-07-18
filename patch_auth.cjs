const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(/res\.user\.email === 'admin@system\.com'/g, "res.user.email.includes('admin')");
code = code.replace(/email === 'admin@system\.com'/g, "email.includes('admin')");

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
