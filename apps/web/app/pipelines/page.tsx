import { Suspense } from "react";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { PipelineTable } from "../../src/dashboard/pipeline-table";
import { loadDashboardPipelines } from "../../src/dashboard/load-dashboard-data";
import { formatLatestTimestamp } from "../../src/ui/format";
import {
  DebugLink,
  LoadingSection,
  PageHero,
  PageMeta,
  PageShell,
  Section,
  TableSkeleton
} from "../../src/ui/primitives";

export const dynamic = "force-dynamic";

export default function PipelinesPage() {
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

      <Suspense
        fallback={
          <LoadingSection
            kicker="Pipeline Sample"
            title="Latest 50 market records"
            description="Loading the latest market pipeline records."
          >
            <TableSkeleton columns={8} rows={8} />
          </LoadingSection>
        }
      >
        <PipelinesTableSection />
      </Suspense>
    </PageShell>
  );
}

async function PipelinesTableSection() {
  const apiBaseUrl = getApiBaseUrl();
  const pipelines = await loadDashboardPipelines(50);
  const latestPipelineUpdate = formatLatestTimestamp(
    pipelines.map((pipeline) => pipeline.updatedAt)
  );

  return (
    <Section
      kicker="Pipeline Sample"
      title="Latest 50 market records"
      description={`Loaded ${pipelines.length} market pipeline records. Rows are ordered by latest update from the API sample. Latest update: ${latestPipelineUpdate}.`}
      action={
        <DebugLink href={`${apiBaseUrl}/api/dashboard/pipelines?limit=50`}>
          Pipelines API
        </DebugLink>
      }
    >
      <PipelineTable pipelines={pipelines} showMarketKey />
    </Section>
  );
}
