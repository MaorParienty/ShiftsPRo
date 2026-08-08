// Server-side Supabase client using only the public/anon key.
// Privileged operations for the custom employee session (not Supabase Auth)
// go through secret-gated SECURITY DEFINER database functions instead of a
// service-role key — see supabase/migrations for the `employee_*` functions
// and the `_require_secret` gate. Never add a service-role client here.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabasePublicClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _client: ReturnType<typeof createSupabasePublicClient> | undefined;

export const supabasePublic = new Proxy({} as ReturnType<typeof createSupabasePublicClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createSupabasePublicClient();
    return Reflect.get(_client, prop, receiver);
  },
});
