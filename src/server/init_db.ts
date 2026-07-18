import { query } from './db';

export async function initDb() {
  try {
    console.log('Initializing database tables...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        type TEXT,
        topic TEXT,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        subject TEXT,
        html TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;

      -- Normalize profiles table columns
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_expiry TIMESTAMP WITH TIME ZONE;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS joined TEXT;

      -- Copy data from camelCase columns if they exist
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='firstName') THEN
          UPDATE profiles SET first_name = "firstName" WHERE first_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lastName') THEN
          UPDATE profiles SET last_name = "lastName" WHERE last_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tierExpiry') THEN
          UPDATE profiles SET tier_expiry = "tierExpiry" WHERE tier_expiry IS NULL;
        END IF;
      END $$;
    `);
    console.log('Database tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
  }
}
