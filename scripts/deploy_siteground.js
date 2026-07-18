import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

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

deploy();
