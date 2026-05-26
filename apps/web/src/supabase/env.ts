export function getSupabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    // Return placeholder for development/preview without Supabase
    console.warn("[v0] NEXT_PUBLIC_SUPABASE_URL not set - using placeholder");
    return "https://placeholder.supabase.co";
  }

  return value;
}

export function getSupabasePublishableKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!value) {
    // Return placeholder for development/preview without Supabase
    console.warn("[v0] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set - using placeholder");
    return "placeholder-key";
  }

  return value;
}

export function getSupabasePrivilegedKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    // Return placeholder for development/preview without Supabase
    console.warn("[v0] SUPABASE_SECRET_KEY not set - using placeholder");
    return "placeholder-secret-key";
  }

  return value;
}
