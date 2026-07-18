const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace("require('path').join", "path.join");
code = code.replace("require('fs').existsSync", "fs.existsSync");
code = code.replace("require('path').join", "path.join");
code = code.replace("require('fs').existsSync", "fs.existsSync");

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts again");
