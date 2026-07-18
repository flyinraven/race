const fs = require('fs');

const code = fs.readFileSync('server.ts', 'utf-8');

const target = "app.get('/api/ai_batch', (req, res) => {";
const replacement = `app.get('/api/source-code', (req, res) => {
    let target = require('path').join(process.cwd(), 'public', 'race-exam-source.zip');
    if (!require('fs').existsSync(target)) {
      target = require('path').join(process.cwd(), 'dist', 'race-exam-source.zip');
    }
    if (require('fs').existsSync(target)) {
      res.download(target, 'race-exam-source.zip');
    } else {
      res.status(404).send('Source code zip not found.');
    }
  });

  app.get('/api/ai_batch', (req, res) => {`;

const newCode = code.replace(target, replacement);
fs.writeFileSync('server.ts', newCode);
console.log("Patched server.ts");
