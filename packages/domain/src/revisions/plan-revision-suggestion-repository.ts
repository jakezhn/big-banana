import type { PlanRevision } from "@big-banana/contracts";

export type ReceivedPlanRevisionSuggestion = {
  planId: string;
  tradePlanVersionId: string;
  marketKey: string;
  sourceEventKey: string;
  revisionAction: PlanRevision["revision_action"];
  reason: PlanRevision["reason"];
  changedFields: PlanRevision["changed_fields"];
  newInvalidation: PlanRevision["new_invalidation"];
  newManagementRules: PlanRevision["new_management_rules"];
  requiresUserReview: PlanRevision["requires_user_review"];
  agentRunId: string | null;
  createdAt: string;
};

export type StoredPlanRevisionSuggestion = ReceivedPlanRevisionSuggestion & {
  id: string;
};

export interface PlanRevisionSuggestionRepository {
  recordPlanRevisionSuggestion(
    suggestion: ReceivedPlanRevisionSuggestion
  ): Promise<StoredPlanRevisionSuggestion>;

  getLatestPlanRevisionSuggestionByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion | null>;

  listPlanRevisionSuggestionsByPlanId(
    planId: string,
    limit?: number
  ): Promise<StoredPlanRevisionSuggestion[]>;
}
