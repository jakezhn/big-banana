export function getApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.API_BASE_URL ??
    env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}
