import { describe, expect, it } from "vitest";
import { handleGetSupabaseHealthRequest } from "../../src/supabase/handle-get-supabase-health-request.js";

describe("GET /api/supabase/health", () => {
  it("returns sdk readiness and probe results", async () => {
    const response = await handleGetSupabaseHealthRequest({
      async getSessionUserId() {
        return "user-1";
      },
      async getWebhookEventsCount() {
        return 12;
      },
      async getStorageBucketCount() {
        return 3;
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      framework: "nextjs",
      sdk: {
        browser_client_configured: true,
        server_client_configured: true,
        admin_client_configured: true
      },
      auth: {
        user_id: "user-1"
      },
      database: {
        reachable: true,
        webhook_events_count: 12
      },
      storage: {
        reachable: true,
        bucket_count: 3
      }
    });
  });

  it("maps missing env style failures to not configured", async () => {
    const response = await handleGetSupabaseHealthRequest({
      async getSessionUserId() {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
      },
      async getWebhookEventsCount() {
        return 0;
      },
      async getStorageBucketCount() {
        return 0;
      }
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "supabase_not_configured",
      detail: "NEXT_PUBLIC_SUPABASE_URL is required"
    });
  });
});
