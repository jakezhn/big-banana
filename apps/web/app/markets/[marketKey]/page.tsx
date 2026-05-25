import Link from "next/link";
import { getApiBaseUrl } from "../../../src/api/get-api-base-url";
import { loadMarketPipeline } from "../../../src/dashboard/load-dashboard-data";

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
    ["Ticker", pipeline.marketState?.tickerid ?? "—"],
    ["Timeframe", pipeline.marketState?.timeframe ?? "—"],
    ["Position", pipeline.currentPosition?.positionSide ?? "flat"],
    ["Signed Qty", formatNumber(pipeline.currentPosition?.signedQty ?? 0)],
    ["Avg Entry", formatNullableNumber(pipeline.currentPosition?.avgEntryPrice)]
  ] as const;

  return (
    <main className="dashboard-shell">
      <section className="hero-panel hero-panel-compact">
        <div>
          <p className="eyebrow">Market Detail</p>
          <h1>{marketKey}</h1>
          <p className="hero-copy">
            Single-market execution trace across state, plan, risk, intent,
            order, fill, and current position.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/pipelines" className="action-link">
            Back to Pipeline Monitor
          </Link>
          <Link
            href={`${apiBaseUrl}/api/market-pipeline?market_key=${encodeURIComponent(marketKey)}`}
            className="action-link action-link-muted"
          >
            View Market API
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Snapshot</p>
            <h2>Current execution state</h2>
          </div>
        </div>
        <div className="card-grid">
          {summaryCards.map(([label, value]) => (
            <article key={label} className="metric-card">
              <p className="metric-label">{label}</p>
              <p className="metric-value metric-value-compact">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Lifecycle</p>
            <h2>Plan, revision, review, and lessons</h2>
          </div>
        </div>
        <div className="card-grid">
          <article className="metric-card">
            <p className="metric-label">Plan Action</p>
            <p className="metric-value metric-value-compact">
              {pipeline.tradePlanVersion?.action ?? "—"}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Execution State</p>
            <p className="metric-value metric-value-compact">
              {pipeline.tradePlanVersion?.executionPlaybook.state ?? "—"}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Latest Revision</p>
            <p className="metric-value metric-value-compact">
              {pipeline.latestPlanRevisionSuggestion?.revisionAction ?? "—"}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Review Summary</p>
            <p className="metric-value metric-value-compact">
              {pipeline.latestPostPlanReview
                ? truncate(pipeline.latestPostPlanReview.outcomeSummary, 96)
                : "—"}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Lesson Candidates</p>
            <p className="metric-value metric-value-compact">
              {pipeline.memoryLessonCandidates.length}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Review Created</p>
            <p className="metric-value metric-value-compact">
              {pipeline.latestPostPlanReview
                ? formatTimestamp(pipeline.latestPostPlanReview.createdAt)
                : "—"}
            </p>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Lessons</p>
            <h2>Scoped lesson candidates</h2>
          </div>
        </div>
        {pipeline.memoryLessonCandidates.length === 0 ? (
          <p className="empty-cell">No lesson candidates recorded yet.</p>
        ) : (
          <div className="detail-grid">
            {pipeline.memoryLessonCandidates.map((candidate) => (
              <article key={candidate.id} className="detail-card">
                <p className="metric-label">{candidate.status}</p>
                <p className="metric-value metric-value-compact">
                  {candidate.lesson}
                </p>
                <pre className="detail-pre">
                  {JSON.stringify(
                    {
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
                    },
                    null,
                    2
                  )}
                </pre>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Chain</p>
            <h2>Latest pipeline records</h2>
          </div>
        </div>
        <div className="detail-grid">
          <DetailCard
            title="Market State"
            content={JSON.stringify(pipeline.marketState, null, 2)}
          />
          <DetailCard
            title="Trade Plan"
            content={JSON.stringify(pipeline.tradePlanVersion, null, 2)}
          />
          <DetailCard
            title="Risk Verdict"
            content={JSON.stringify(pipeline.riskVerdict, null, 2)}
          />
          <DetailCard
            title="Latest Revision Suggestion"
            content={JSON.stringify(
              pipeline.latestPlanRevisionSuggestion,
              null,
              2
            )}
          />
          <DetailCard
            title="Latest Post-Plan Review"
            content={JSON.stringify(pipeline.latestPostPlanReview, null, 2)}
          />
          <DetailCard
            title="Execution Intent"
            content={JSON.stringify(pipeline.executionIntent, null, 2)}
          />
          <DetailCard
            title="Latest Order"
            content={JSON.stringify(pipeline.latestOrder, null, 2)}
          />
          <DetailCard
            title="Latest Fill"
            content={JSON.stringify(pipeline.latestFill, null, 2)}
          />
          <DetailCard
            title="Current Position"
            content={JSON.stringify(pipeline.currentPosition, null, 2)}
          />
        </div>
      </section>
    </main>
  );
}

function DetailCard({ title, content }: { title: string; content: string }) {
  return (
    <article className="detail-card">
      <p className="metric-label">{title}</p>
      <pre className="detail-pre">{content}</pre>
    </article>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8
  }).format(value);
}

function formatNullableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return formatNumber(value);
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
