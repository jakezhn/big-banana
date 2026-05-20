import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePrivilegedKey,
  getSupabaseUrl
} from "./env";

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabasePrivilegedKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
