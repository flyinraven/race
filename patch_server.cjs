const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes("import { initDb }")) {
  code = code.replace('import express from "express";', 'import express from "express";\nimport { initDb } from "./src/server/init_db";');
}

if (!code.includes("initDb();")) {
  code = code.replace('const app = express();', 'const app = express();\n\n  if (process.env.DATABASE_URL) {\n    initDb().catch(e => console.warn("DB Init Error:", e));\n  }\n');
}

fs.writeFileSync('server.ts', code);
