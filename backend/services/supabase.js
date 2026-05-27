import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

function createAdminClient() {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL, SUPABASE_SERVICE_KEY)");
  }
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let supabaseAdminInstance = null;

export function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createAdminClient();
  }
  return supabaseAdminInstance;
}

/** @deprecated Use getSupabaseAdmin() — kept for existing imports */
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseAdmin();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export function createUserClient(accessToken) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
