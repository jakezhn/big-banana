import type { MemoryLessonCandidateItem } from "@big-banana/contracts";

export type ReceivedMemoryLessonCandidate = {
  postPlanReviewId: string;
  planId: string;
  tradePlanVersionId: string;
  marketKey: string;
  sourceEventKey: string;
  lesson: MemoryLessonCandidateItem["lesson"];
  scopeMarket: MemoryLessonCandidateItem["scope"]["market"];
  scopeAssetClass: MemoryLessonCandidateItem["scope"]["asset_class"];
  scopeSymbol: MemoryLessonCandidateItem["scope"]["symbol"];
  scopeTimeframe: MemoryLessonCandidateItem["scope"]["timeframe"];
  scopeRegime: MemoryLessonCandidateItem["scope"]["regime"];
  scopeSignalType: MemoryLessonCandidateItem["scope"]["signal_type"];
  confidence: MemoryLessonCandidateItem["confidence"];
  sampleSize: MemoryLessonCandidateItem["sample_size"];
  decayDays: MemoryLessonCandidateItem["decay_days"];
  retrievalHint: MemoryLessonCandidateItem["retrieval_hint"];
  status: "pending_review" | "accepted" | "rejected";
  agentRunId: string | null;
  createdAt: string;
};

export type StoredMemoryLessonCandidate = ReceivedMemoryLessonCandidate & {
  id: string;
};

export interface MemoryLessonCandidateRepository {
  recordMemoryLessonCandidate(
    candidate: ReceivedMemoryLessonCandidate
  ): Promise<StoredMemoryLessonCandidate>;

  listMemoryLessonCandidatesByPostPlanReviewId(
    postPlanReviewId: string
  ): Promise<StoredMemoryLessonCandidate[]>;
}
