import type { DashboardPipelineListItem } from "@big-banana/domain";
import type { ReactNode } from "react";
import { formatTimestamp } from "../ui/format";
import { DataTable, EmptyState, InlineLink, StatusPill } from "../ui/primitives";

export function PipelineTable({
  pipelines,
  showMarketKey = false,
  emptyMessage = "No pipeline records available yet."
}: {
  pipelines: DashboardPipelineListItem[];
  showMarketKey?: boolean;
  emptyMessage?: string;
}): ReactNode {
  const colSpan = showMarketKey ? 8 : 7;

  return (
    <DataTable>
      <thead>
        <tr>
          <th>{showMarketKey ? "Market Key" : "Market"}</th>
          {showMarketKey ? <th>Ticker</th> : null}
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
          <EmptyState colSpan={colSpan}>{emptyMessage}</EmptyState>
        ) : (
          pipelines.map((pipeline) => (
            <tr key={pipeline.marketKey}>
              <td>
                <InlineLink href={`/markets/${encodeURIComponent(pipeline.marketKey)}`}>
                  {showMarketKey ? pipeline.marketKey : pipeline.tickerid}
                </InlineLink>
              </td>
              {showMarketKey ? <td>{pipeline.tickerid}</td> : null}
              <td>{pipeline.timeframe}</td>
              <td>
                <StatusPill value={pipeline.pipelineStatus} />
              </td>
              <td>{pipeline.tradePlanAction ?? "-"}</td>
              <td>{pipeline.riskVerdict ?? "-"}</td>
              <td>{pipeline.latestOrderStatus ?? "-"}</td>
              <td>{formatTimestamp(pipeline.updatedAt)}</td>
            </tr>
          ))
        )}
      </tbody>
    </DataTable>
  );
}
