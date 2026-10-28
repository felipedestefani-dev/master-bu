import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

export async function client() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
