import { createClient } from '@supabase/supabase-js';

// Note: This client should ONLY be used in server-side contexts where
// the SUPABASE_SERVICE_ROLE_KEY is available and safe to use.
// It bypasses Row Level Security (RLS), so use with caution.

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
