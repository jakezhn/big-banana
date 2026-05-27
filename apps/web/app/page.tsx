import { Suspense } from "react";
import { getApiBaseUrl } from "../src/api/get-api-base-url";
import { PipelineTable } from "../src/dashboard/pipeline-table";
import {
  loadDashboardOverview,
  loadDashboardPipelines
} from "../src/dashboard/load-dashboard-data";
import { formatInteger, formatLatestTimestamp } from "../src/ui/format";
import {
  DebugLink,
  LoadingSection,
  MetricGrid,
  MetricGridSkeleton,
  PageMeta,
  PageHero,
  PageShell,
  Section,
  TableSkeleton,
  TextLink
} from "../src/ui/primitives";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="MVP Validation Console"
        title="Trading pipeline visibility before real AI rollout."
        copy="This dashboard tracks the paper execution chain from webhook ingest to order terminal states. It is designed for monitoring, debugging, and intervention readiness."
        compact={false}
        actions={[
          { href: "/pipelines", label: "Open Pipeline Monitor" },
          { href: "/agent-runs", label: "Open Agent Runs" }
        ]}
      />
      <PageMeta />

      <Suspense
        fallback={
          <LoadingSection kicker="Overview" title="Today's operating totals">
            <MetricGridSkeleton count={8} />
          </LoadingSection>
        }
      >
        <OverviewTotalsSection />
      </Suspense>

      <Suspense
        fallback={
          <LoadingSection
            kicker="Pipeline Monitor"
            title="Recent market pipelines"
            description="Loading the latest pipeline read-model sample."
          >
            <TableSkeleton columns={7} rows={5} />
          </LoadingSection>
        }
      >
        <RecentPipelinesSection />
      </Suspense>
    </PageShell>
  );
}

async function OverviewTotalsSection() {
  const apiBaseUrl = getApiBaseUrl();
  const overview = await loadDashboardOverview();

  const cards = [
    ["Signals Today", formatInteger(overview.signalsTodayCount)],
    ["Plans Today", formatInteger(overview.plansTodayCount)],
    ["Risk Rejects", formatInteger(overview.riskRejectsTodayCount)],
    ["Orders Submitted", formatInteger(overview.ordersSubmittedTodayCount)],
    ["Filled", formatInteger(overview.ordersFilledTodayCount)],
    ["Canceled", formatInteger(overview.ordersCanceledTodayCount)],
    ["Open Positions", formatInteger(overview.openPositionsCount)],
    ["Interventions", formatInteger(overview.interventionsTodayCount)]
  ] as const;

  return (
    <Section
      kicker="Overview"
      title="Today's operating totals"
      action={
        <DebugLink href={`${apiBaseUrl}/api/dashboard/overview`}>
          Overview API
        </DebugLink>
      }
    >
      <MetricGrid items={cards} />
    </Section>
  );
}

async function RecentPipelinesSection() {
  const pipelines = await loadDashboardPipelines(12);
  const latestPipelineUpdate = formatLatestTimestamp(
    pipelines.map((pipeline) => pipeline.updatedAt)
  );

  return (
    <Section
      kicker="Pipeline Monitor"
      title="Recent market pipelines"
      description={`Showing ${pipelines.length} recent pipeline records from the dashboard read model sample. Latest update: ${latestPipelineUpdate}.`}
      action={<TextLink href="/pipelines">View full list</TextLink>}
    >
      <PipelineTable pipelines={pipelines} />
    </Section>
  );
}
