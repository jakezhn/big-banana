import { getApiBaseUrl } from "../src/api/get-api-base-url";
import { PipelineTable } from "../src/dashboard/pipeline-table";
import {
  loadDashboardOverview,
  loadDashboardPipelines
} from "../src/dashboard/load-dashboard-data";
import { formatInteger } from "../src/ui/format";
import {
  DebugLink,
  MetricGrid,
  PageMeta,
  PageHero,
  PageShell,
  Section,
  TextLink
} from "../src/ui/primitives";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const apiBaseUrl = getApiBaseUrl();
  const [overview, pipelines] = await Promise.all([
    loadDashboardOverview(),
    loadDashboardPipelines(12)
  ]);

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

      <Section
        kicker="Pipeline Monitor"
        title="Recent market pipelines"
        action={<TextLink href="/pipelines">View full list</TextLink>}
      >
        <PipelineTable pipelines={pipelines} />
      </Section>
    </PageShell>
  );
}
