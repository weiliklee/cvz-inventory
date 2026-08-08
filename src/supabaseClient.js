import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
