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
