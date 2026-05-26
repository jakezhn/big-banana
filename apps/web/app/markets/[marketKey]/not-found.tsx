import Link from "next/link";

export default function MarketNotFoundPage() {
  return (
    <main className="dashboard-shell">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Market Detail</p>
            <h2>Market pipeline not found</h2>
          </div>
        </div>
        <p className="hero-copy">
          No latest pipeline read model exists for this market key.
        </p>
        <Link href="/pipelines" className="action-link">
          Back to Pipeline Monitor
        </Link>
      </section>
    </main>
  );
}
