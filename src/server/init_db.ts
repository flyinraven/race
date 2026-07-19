import { query } from './db';

export async function initDb() {
  try {
    console.log('Initializing database tables...');

    // Each statement must be its own query() call — pg does not support multi-statement strings
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        target_exam TEXT,
        exam_date TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        type TEXT,
        topic TEXT,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        subject TEXT,
        html TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        exam_type TEXT,
        score TEXT,
        max_score TEXT,
        time_taken TEXT,
        answers JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS curriculum_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic TEXT NOT NULL,
        filename TEXT NOT NULL,
        year TEXT NOT NULL,
        text_content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Column migrations — each ALTER TABLE is its own call
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_token TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_token_expires_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

    // Normalize profiles columns (critical — these are what admin user list queries use)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student'`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_expiry TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS joined TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

    // Migrate data from any old camelCase columns if they exist
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='firstName') THEN
          UPDATE profiles SET first_name = "firstName" WHERE first_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lastName') THEN
          UPDATE profiles SET last_name = "lastName" WHERE last_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tierExpiry') THEN
          UPDATE profiles SET tier_expiry = "tierExpiry"::timestamp with time zone WHERE tier_expiry IS NULL;
        END IF;
      END $$
    `);

    console.log('Database tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
  }
}
