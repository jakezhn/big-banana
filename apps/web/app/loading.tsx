import {
  LoadingSection,
  MetricGridSkeleton,
  PageShell,
  TableSkeleton
} from "../src/ui/primitives";

export default function LoadingPage() {
  return (
    <PageShell>
      <LoadingSection
        title="Loading dashboard data"
        description="Preparing the latest read-model components."
      >
        <MetricGridSkeleton count={4} />
      </LoadingSection>
      <LoadingSection title="Loading pipeline records">
        <TableSkeleton columns={7} rows={4} />
      </LoadingSection>
    </PageShell>
  );
}
