-- Führen Sie diesen SQL-Code im Supabase SQL Editor aus, 
-- um Ihre bestehende 'users' Tabelle zu erweitern.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS kit_kuerzel text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS affiliation text,
ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Optional: Falls 'name' noch nicht existiert (Sie sagten, es existiert bereits)
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
