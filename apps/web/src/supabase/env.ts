export function getSupabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  return value;
}

export function getSupabasePublishableKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
  }

  return value;
}

export function getSupabasePrivilegedKey(
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required"
    );
  }

  return value;
}
