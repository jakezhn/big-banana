export default function LoadingPage() {
  return (
    <main className="dashboard-shell">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Loading</p>
            <h2>Loading dashboard data</h2>
          </div>
        </div>
        <p className="empty-cell">Waiting for the latest pipeline read models.</p>
      </section>
    </main>
  );
}
