-- Supabase Setup Script for User Profiles
-- Paste this script into your Supabase SQL Editor and click "Run".

-- 1. Create the `profiles` table (if you haven't already created it, this is safe to run again)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  "firstName" text,
  "lastName" text,
  role text default 'student',
  tier text default 'free',
  "tierExpiry" text,
  joined text,
  profile text
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Setup Policies allowing authenticated users to manage their data
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can delete own profile." ON public.profiles;
CREATE POLICY "Users can delete own profile."
  ON public.profiles FOR DELETE
  USING (auth.uid()::text = id::text);


-- 4. Create an automatic trigger so when you sign up in the WebApp,
-- Supabase automatically generates the corresponding public.profiles row.
-- This bypasses the RLS insert issues common during email confirmation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, "firstName", "lastName", role, tier, joined)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'firstName',
    new.raw_user_meta_data->>'lastName',
    'student',
    COALESCE(new.raw_user_meta_data->>'plan', 'free'),
    TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
