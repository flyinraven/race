import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import 'dotenv/config';

function deployRenderBackend() {
  const RENDER_DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK || 'https://api.render.com/deploy/srv-d9dg83taeets7394tl8g?key=IZqdGq5dX40';
  
  return new Promise((resolve, reject) => {
    console.log('🔄 Triggering Render backend redeploy...');
    const url = new URL(RENDER_DEPLOY_HOOK);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log('✅ Render backend deploy triggered successfully! (It will be live in ~1-2 minutes)');
          resolve();
        } else {
          console.warn(`⚠️  Render deploy hook returned status ${res.statusCode}: ${data}`);
          resolve(); // Non-fatal: frontend deploy already succeeded
        }
      });
    });
    req.on('error', (e) => {
      console.warn('⚠️  Could not reach Render deploy hook:', e.message);
      resolve(); // Non-fatal
    });
    req.end();
  });
}

function deploy() {
  const {
    SITEGROUND_SSH_HOST,
    SITEGROUND_SSH_PORT,
    SITEGROUND_SSH_USER,
    SITEGROUND_REMOTE_PATH,
  } = process.env;

  const port = SITEGROUND_SSH_PORT || '18765';

  if (!SITEGROUND_SSH_HOST || !SITEGROUND_SSH_USER || !SITEGROUND_REMOTE_PATH) {
    console.error('❌ Missing SiteGround deployment configuration in .env!');
    console.error('Please ensure the following variables are defined in your .env file:');
    console.error('  SITEGROUND_SSH_HOST');
    console.error('  SITEGROUND_SSH_PORT (defaults to 18765)');
    console.error('  SITEGROUND_SSH_USER');
    console.error('  SITEGROUND_REMOTE_PATH');
    process.exit(1);
  }

  const keyPath = path.join(process.cwd(), '.siteground_key');
  if (!fs.existsSync(keyPath)) {
    console.error('❌ SSH private key file `.siteground_key` not found in root directory!');
    console.error('Please save your SiteGround private key as a file named `.siteground_key` in the project root.');
    process.exit(1);
  }

  // Adjust file permissions for ssh key to satisfy ssh/scp on Windows if needed (usually optional on Windows but good practice)
  try {
    fs.chmodSync(keyPath, '400');
  } catch (e) {
    // Ignore if permission change fails (e.g. on basic Windows filesystem)
  }

  console.log('🚀 Starting deployment to SiteGround...');
  console.log(`Target: ${SITEGROUND_SSH_USER}@${SITEGROUND_SSH_HOST}:${port} -> ${SITEGROUND_REMOTE_PATH}`);

  // Run SCP command
  // -o StrictHostKeyChecking=no bypasses the interactive prompt to trust the host key
  const scpCommand = `scp -P ${port} -i "${keyPath}" -o StrictHostKeyChecking=no -r dist/. "${SITEGROUND_SSH_USER}@${SITEGROUND_SSH_HOST}:${SITEGROUND_REMOTE_PATH}"`;

  try {
    console.log('Uploading files...');
    execSync(scpCommand, { stdio: 'inherit' });
    console.log('✅ Deployment successful! Your site is live.');
  } catch (error) {
    console.error('❌ Deployment failed during upload:', error.message);
    process.exit(1);
  }
}

async function main() {
  deploy();
  await deployRenderBackend();
}

main();
