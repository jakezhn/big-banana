import type { PostPlanReview } from "@big-banana/contracts";

export type ReceivedPostPlanReview = {
  planId: string;
  tradePlanVersionId: string;
  marketKey: string;
  sourceEventKey: string;
  outcomeSummary: PostPlanReview["outcome_summary"];
  whatWorked: PostPlanReview["what_worked"];
  whatFailed: PostPlanReview["what_failed"];
  missedContext: PostPlanReview["missed_context"];
  earlyWarningSignals: PostPlanReview["early_warning_signals"];
  lessonCandidates: PostPlanReview["lesson_candidates"];
  shouldUpdateStrategyMemory: PostPlanReview["should_update_strategy_memory"];
  agentRunId: string | null;
  createdAt: string;
};

export type StoredPostPlanReview = ReceivedPostPlanReview & {
  id: string;
};

export interface PostPlanReviewRepository {
  recordPostPlanReview(
    review: ReceivedPostPlanReview
  ): Promise<StoredPostPlanReview>;

  getLatestPostPlanReviewByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview | null>;

  listPostPlanReviewsByPlanId(
    planId: string,
    limit?: number
  ): Promise<StoredPostPlanReview[]>;
}
