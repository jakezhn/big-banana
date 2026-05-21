type ErrorResponse = {
  ok: false;
  error: "supabase_not_configured" | "supabase_probe_failed";
  detail: string;
};

type SuccessResponse = {
  ok: true;
  framework: "nextjs";
  sdk: {
    browser_client_configured: true;
    server_client_configured: true;
    admin_client_configured: true;
  };
  auth: {
    user_id: string | null;
  };
  database: {
    reachable: boolean;
    webhook_events_count: number | null;
  };
  storage: {
    reachable: boolean;
    bucket_count: number | null;
  };
};

export type SupabaseHealthDependencies = {
  getSessionUserId: () => Promise<string | null>;
  getWebhookEventsCount: () => Promise<number | null>;
  getStorageBucketCount: () => Promise<number | null>;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleGetSupabaseHealthRequest(
  dependencies: SupabaseHealthDependencies
): Promise<Response> {
  try {
    const [userId, webhookEventsCount, bucketCount] = await Promise.all([
      dependencies.getSessionUserId(),
      dependencies.getWebhookEventsCount(),
      dependencies.getStorageBucketCount()
    ]);

    return jsonResponse(
      {
        ok: true,
        framework: "nextjs",
        sdk: {
          browser_client_configured: true,
          server_client_configured: true,
          admin_client_configured: true
        },
        auth: {
          user_id: userId
        },
        database: {
          reachable: webhookEventsCount !== null,
          webhook_events_count: webhookEventsCount
        },
        storage: {
          reachable: bucketCount !== null,
          bucket_count: bucketCount
        }
      },
      200
    );
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown Supabase error";
    const notConfigured =
      detail.includes("NEXT_PUBLIC_SUPABASE_") ||
      detail.includes("SUPABASE_SECRET_KEY") ||
      detail.includes("SUPABASE_SERVICE_ROLE_KEY");

    return jsonResponse(
      {
        ok: false,
        error: notConfigured
          ? "supabase_not_configured"
          : "supabase_probe_failed",
        detail
      },
      notConfigured ? 500 : 502
    );
  }
}
