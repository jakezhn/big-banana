import Link from "next/link";
import { getApiBaseUrl } from "../src/api/get-api-base-url";
import { loadDashboardOverview, loadDashboardPipelines } from "../src/dashboard/load-dashboard-data";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function DashboardPage() {
  const apiBaseUrl = getApiBaseUrl();
  const [overview, pipelines] = await Promise.all([
    loadDashboardOverview(),
    loadDashboardPipelines(12)
  ]);

  const cards = [
    ["Signals Today", overview.signalsTodayCount],
    ["Plans Today", overview.plansTodayCount],
    ["Risk Rejects", overview.riskRejectsTodayCount],
    ["Orders Submitted", overview.ordersSubmittedTodayCount],
    ["Filled", overview.ordersFilledTodayCount],
    ["Canceled", overview.ordersCanceledTodayCount],
    ["Open Positions", overview.openPositionsCount],
    ["Interventions", overview.interventionsTodayCount]
  ] as const;

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">MVP Validation Console</p>
          <h1>Trading pipeline visibility before real AI rollout.</h1>
          <p className="hero-copy">
            This dashboard tracks the paper execution chain from webhook ingest
            to order terminal states. It is designed for monitoring, debugging,
            and intervention readiness rather than end-user presentation.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/pipelines" className="action-link">
            Open Pipeline Monitor
          </Link>
          <Link href="/agent-runs" className="action-link action-link-muted">
            Open Agent Runs
          </Link>
          <Link href={`${apiBaseUrl}/api/dashboard/overview`} className="action-link action-link-muted">
            View Overview API
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Overview</p>
            <h2>Today&apos;s operating totals</h2>
          </div>
        </div>
        <div className="card-grid">
          {cards.map(([label, value]) => (
            <article key={label} className="metric-card">
              <p className="metric-label">{label}</p>
              <p className="metric-value">{numberFormatter.format(value)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Pipeline Monitor</p>
            <h2>Recent market pipelines</h2>
          </div>
          <Link href="/pipelines" className="text-link">
            View full list
          </Link>
        </div>
        <PipelinesTable pipelines={pipelines} />
      </section>
    </main>
  );
}

function PipelinesTable({
  pipelines
}: {
  pipelines: Awaited<ReturnType<typeof loadDashboardPipelines>>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Market</th>
            <th>TF</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Risk</th>
            <th>Order</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {pipelines.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-cell">
                No pipeline records available yet.
              </td>
            </tr>
          ) : (
            pipelines.map(pipeline => (
              <tr key={pipeline.marketKey}>
                <td>
                  <Link href={`/markets/${encodeURIComponent(pipeline.marketKey)}`}>
                    {pipeline.tickerid}
                  </Link>
                </td>
                <td>{pipeline.timeframe}</td>
                <td>
                  <span className={`status-pill status-${pipeline.pipelineStatus}`}>
                    {pipeline.pipelineStatus}
                  </span>
                </td>
                <td>{pipeline.tradePlanAction ?? "—"}</td>
                <td>{pipeline.riskVerdict ?? "—"}</td>
                <td>{pipeline.latestOrderStatus ?? "—"}</td>
                <td>{formatTimestamp(pipeline.updatedAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
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
