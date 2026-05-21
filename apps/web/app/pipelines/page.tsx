import Link from "next/link";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { loadDashboardPipelines } from "../../src/dashboard/load-dashboard-data";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const apiBaseUrl = getApiBaseUrl();
  const pipelines = await loadDashboardPipelines(50);

  return (
    <main className="dashboard-shell">
      <section className="hero-panel hero-panel-compact">
        <div>
          <p className="eyebrow">Pipeline Monitor</p>
          <h1>Recent market pipelines</h1>
          <p className="hero-copy">
            A compact operating view across the most recently updated markets.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/" className="action-link">
            Back to Overview
          </Link>
          <Link href={`${apiBaseUrl}/api/dashboard/pipelines?limit=50`} className="action-link action-link-muted">
            View Pipelines API
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Market Key</th>
                <th>Ticker</th>
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
                  <td colSpan={8} className="empty-cell">
                    No pipeline records available yet.
                  </td>
                </tr>
              ) : (
                pipelines.map(pipeline => (
                  <tr key={pipeline.marketKey}>
                    <td>{pipeline.marketKey}</td>
                    <td>{pipeline.tickerid}</td>
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
      </section>
    </main>
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
