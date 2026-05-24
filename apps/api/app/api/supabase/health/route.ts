import { handleGetSupabaseHealthRequest } from "../../../../src/supabase/handle-get-supabase-health-request";
import { createSupabaseAdminClient } from "../../../../src/supabase/admin";
import { createSupabaseServerClient } from "../../../../src/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  return handleGetSupabaseHealthRequest({
    async getSessionUserId() {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      return user?.id ?? null;
    },
    async getWebhookEventsCount() {
      const supabase = createSupabaseAdminClient();
      const { count, error } = await supabase
        .from("webhook_events")
        .select("id", { count: "exact", head: true });

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    async getStorageBucketCount() {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.storage.listBuckets();

      if (error) {
        throw error;
      }

      return data.length;
    }
  });
}
