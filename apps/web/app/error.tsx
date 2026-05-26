"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorDetails = getErrorDetails(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-shell">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Route Error</p>
            <h2>{errorDetails.title}</h2>
          </div>
        </div>
        <p className="hero-copy">{errorDetails.copy}</p>
        <button type="button" className="action-link button-reset" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}

function getErrorDetails(error: Error): { title: string; copy: string } {
  const message = error.message.toLowerCase();

  if (message.includes("failed to load dashboard")) {
    return {
      title: "Dashboard API could not be loaded",
      copy: "Check that the API service is running on API_BASE_URL and that the dashboard read-model endpoint is healthy, then retry."
    };
  }

  if (message.includes("failed to load market pipeline")) {
    return {
      title: "Market pipeline could not be loaded",
      copy: "Check that the market pipeline endpoint is reachable and that the requested market key exists in the latest read model."
    };
  }

  if (message.includes("supabase")) {
    return {
      title: "Supabase configuration or connectivity failed",
      copy: "Check Supabase environment variables and connectivity, then retry the page."
    };
  }

  return {
    title: "Dashboard data could not be loaded",
    copy: "Check that the API service is running and that Supabase is reachable, then retry the page."
  };
}
