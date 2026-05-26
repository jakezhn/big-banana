import { getApiBaseUrl } from "../../../src/api/get-api-base-url";
import { loadMarketPipeline } from "../../../src/dashboard/load-dashboard-data";
import {
  formatNullableNumber,
  formatNumber,
  formatTimestamp,
  truncate
} from "../../../src/ui/format";
import {
  DetailCard,
  DetailGrid,
  DetailList,
  EmptyState,
  JsonPre,
  MetricGrid,
  PageHero,
  PageShell,
  Section
} from "../../../src/ui/primitives";

export const dynamic = "force-dynamic";

type MarketDetailPageProps = {
  params: Promise<{
    marketKey: string;
  }>;
};

export default async function MarketDetailPage({
  params
}: MarketDetailPageProps) {
  const { marketKey: encodedMarketKey } = await params;
  const marketKey = decodeURIComponent(encodedMarketKey);
  const apiBaseUrl = getApiBaseUrl();
  const pipeline = await loadMarketPipeline(marketKey);

  const summaryCards = [
    ["Pipeline Status", pipeline.pipelineStatus],
    ["Ticker", pipeline.marketState?.tickerid ?? "-"],
    ["Timeframe", pipeline.marketState?.timeframe ?? "-"],
    ["Position", pipeline.currentPosition?.positionSide ?? "flat"],
    ["Signed Qty", formatNumber(pipeline.currentPosition?.signedQty ?? 0)],
    ["Avg Entry", formatNullableNumber(pipeline.currentPosition?.avgEntryPrice)]
  ] as const;
  const overviewRows = [
    ["Latest Plan Version", pipeline.tradePlanVersion?.version?.toString() ?? "-"],
    ["Risk Verdict", pipeline.riskVerdict?.verdict ?? "-"],
    ["Order Status", pipeline.latestOrder?.status ?? "-"],
    ["Fill Price", formatNullableNumber(pipeline.latestFill?.price)],
    ["Lesson Candidate Status", pipeline.memoryLessonCandidates[0]?.status ?? "-"],
    [
      "Last Revision At",
      pipeline.latestPlanRevisionSuggestion
        ? formatTimestamp(pipeline.latestPlanRevisionSuggestion.createdAt)
        : "-"
    ]
  ] as const;
  const actionChecklist = [
    ["Trade plan exists", pipeline.tradePlanVersion ? "ready" : "missing"],
    ["Risk verdict recorded", pipeline.riskVerdict ? "ready" : "missing"],
    ["Execution intent built", pipeline.executionIntent ? "ready" : "missing"],
    ["Order submitted", pipeline.latestOrder ? pipeline.latestOrder.status : "missing"],
    ["Fill recorded", pipeline.latestFill ? "ready" : "missing"],
    [
      "Current position",
      pipeline.currentPosition ? pipeline.currentPosition.positionSide : "flat"
    ]
  ] as const;
  const latestLifecycleEvents = [
    [
      "Plan",
      pipeline.tradePlanVersion
        ? formatTimestamp(pipeline.tradePlanVersion.createdAt)
        : "-"
    ],
    [
      "Revision",
      pipeline.latestPlanRevisionSuggestion
        ? formatTimestamp(pipeline.latestPlanRevisionSuggestion.createdAt)
        : "-"
    ],
    [
      "Review",
      pipeline.latestPostPlanReview
        ? formatTimestamp(pipeline.latestPostPlanReview.createdAt)
        : "-"
    ],
    [
      "Order",
      pipeline.latestOrder ? formatTimestamp(pipeline.latestOrder.submittedAt) : "-"
    ]
  ] as const;

  return (
    <PageShell>
      <PageHero
        eyebrow="Market Detail"
        title={marketKey}
        copy="Single-market execution trace across state, plan, risk, intent, order, fill, current position, reviews, and scoped lessons."
        actions={[
          { href: "/pipelines", label: "Back to Pipeline Monitor" },
          {
            href: `${apiBaseUrl}/api/market-pipeline?market_key=${encodeURIComponent(marketKey)}`,
            label: "View Market API",
            variant: "muted"
          }
        ]}
      />

      <Section kicker="Checklist" title="Current action state">
        <DetailGrid tight>
          <DetailCard title="Execution checklist">
            <DetailList rows={actionChecklist} />
          </DetailCard>
          <DetailCard title="Latest lifecycle timestamps">
            <DetailList rows={latestLifecycleEvents} />
          </DetailCard>
        </DetailGrid>
      </Section>

      <Section kicker="Snapshot" title="Current execution state">
        <MetricGrid items={summaryCards} />
      </Section>

      <Section kicker="Overview" title="Plan and execution summary">
        <DetailGrid tight>
          <DetailCard title="Current summary">
            <DetailList rows={overviewRows} />
          </DetailCard>
          <DetailCard title="Active reasoning summary">
            <div className="callout-stack">
              <ReasoningCallout
                title="Trade plan"
                value={pipeline.tradePlanVersion?.reasoningSummary}
                fallback="No active plan reasoning recorded."
              />
              <ReasoningCallout
                title="Latest revision"
                value={pipeline.latestPlanRevisionSuggestion?.reason}
                fallback="No revision suggestion recorded."
              />
              <ReasoningCallout
                title="Latest review"
                value={pipeline.latestPostPlanReview?.outcomeSummary}
                fallback="No post-plan review recorded."
              />
            </div>
          </DetailCard>
        </DetailGrid>
      </Section>

      <Section kicker="Lifecycle" title="Plan, revision, review, and lessons">
        <MetricGrid
          items={[
            ["Plan Action", pipeline.tradePlanVersion?.action ?? "-"],
            ["Execution State", pipeline.tradePlanVersion?.executionPlaybook.state ?? "-"],
            ["Latest Revision", pipeline.latestPlanRevisionSuggestion?.revisionAction ?? "-"],
            [
              "Review Summary",
              pipeline.latestPostPlanReview
                ? truncate(pipeline.latestPostPlanReview.outcomeSummary, 96)
                : "-"
            ],
            ["Lesson Candidates", pipeline.memoryLessonCandidates.length],
            [
              "Review Created",
              pipeline.latestPostPlanReview
                ? formatTimestamp(pipeline.latestPostPlanReview.createdAt)
                : "-"
            ]
          ]}
        />
      </Section>

      <Section kicker="Lessons" title="Scoped lesson candidates">
        {pipeline.memoryLessonCandidates.length === 0 ? (
          <EmptyState>No lesson candidates recorded yet.</EmptyState>
        ) : (
          <DetailGrid>
            {pipeline.memoryLessonCandidates.map((candidate) => (
              <DetailCard
                key={candidate.id}
                title={`${candidate.status} / confidence ${formatNumber(candidate.confidence)}`}
              >
                <p className="metric-value metric-value-compact">
                  {candidate.lesson}
                </p>
                <JsonPre
                  value={{
                    scope: {
                      market: candidate.scopeMarket,
                      asset_class: candidate.scopeAssetClass,
                      symbol: candidate.scopeSymbol,
                      timeframe: candidate.scopeTimeframe,
                      regime: candidate.scopeRegime,
                      signal_type: candidate.scopeSignalType
                    },
                    confidence: candidate.confidence,
                    sampleSize: candidate.sampleSize,
                    decayDays: candidate.decayDays,
                    retrievalHint: candidate.retrievalHint
                  }}
                />
              </DetailCard>
            ))}
          </DetailGrid>
        )}
      </Section>

      <Section kicker="Chain" title="Latest pipeline records">
        <DetailGrid>
          <RecordCard title="Market State" value={pipeline.marketState} />
          <RecordCard title="Trade Plan" value={pipeline.tradePlanVersion} />
          <RecordCard title="Risk Verdict" value={pipeline.riskVerdict} />
          <RecordCard
            title="Latest Revision Suggestion"
            value={pipeline.latestPlanRevisionSuggestion}
          />
          <RecordCard
            title="Latest Post-Plan Review"
            value={pipeline.latestPostPlanReview}
          />
          <RecordCard title="Execution Intent" value={pipeline.executionIntent} />
          <RecordCard title="Latest Order" value={pipeline.latestOrder} />
          <RecordCard title="Latest Fill" value={pipeline.latestFill} />
          <RecordCard title="Current Position" value={pipeline.currentPosition} />
        </DetailGrid>
      </Section>
    </PageShell>
  );
}

function ReasoningCallout({
  title,
  value,
  fallback
}: {
  title: string;
  value: string | null | undefined;
  fallback: string;
}) {
  return (
    <div className="callout-panel">
      <p className="callout-title">{title}</p>
      <p>{value ? truncate(value, 220) : fallback}</p>
    </div>
  );
}

function RecordCard({ title, value }: { title: string; value: unknown }) {
  return (
    <DetailCard title={title}>
      <JsonPre value={value} />
    </DetailCard>
  );
}
