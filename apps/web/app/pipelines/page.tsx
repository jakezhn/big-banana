import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { PipelineTable } from "../../src/dashboard/pipeline-table";
import { loadDashboardPipelines } from "../../src/dashboard/load-dashboard-data";
import {
  DebugLink,
  PageHero,
  PageMeta,
  PageShell,
  Section
} from "../../src/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const apiBaseUrl = getApiBaseUrl();
  const pipelines = await loadDashboardPipelines(50);

  return (
    <PageShell>
      <PageHero
        eyebrow="Pipeline Monitor"
        title="Recent market pipelines"
        copy="A compact operating view across the most recently updated markets, ordered for fast triage of plan, risk, and order state."
        actions={[
          { href: "/", label: "Back to Overview" }
        ]}
      />
      <PageMeta />

      <Section
        action={
          <DebugLink href={`${apiBaseUrl}/api/dashboard/pipelines?limit=50`}>
            Pipelines API
          </DebugLink>
        }
      >
        <PipelineTable pipelines={pipelines} showMarketKey />
      </Section>
    </PageShell>
  );
}
