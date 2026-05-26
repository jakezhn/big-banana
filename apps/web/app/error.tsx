"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-shell">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Route Error</p>
            <h2>Dashboard data could not be loaded</h2>
          </div>
        </div>
        <p className="hero-copy">
          Check that the API service is running and that Supabase is reachable,
          then retry the page.
        </p>
        <button type="button" className="action-link button-reset" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}
