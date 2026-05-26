import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Big Banana Dashboard",
  description: "Trading pipeline monitor for MVP validation",
  icons: {
    icon: "/assets/brand/bitpunk-favicon.svg"
  }
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body>
        <header className="site-header" aria-label="Primary">
          <Link href="/" className="brand-link" aria-label="Bitpunk dashboard home">
            <img
              src="/assets/brand/bitpunk-logo.svg"
              alt="Bitpunk"
              className="brand-logo"
            />
          </Link>
          <nav className="site-nav" aria-label="Dashboard sections">
            <Link href="/">Overview</Link>
            <Link href="/pipelines">Pipelines</Link>
            <Link href="/agent-runs">Agent Runs</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
