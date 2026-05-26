"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Overview", match: (pathname: string) => pathname === "/" },
  {
    href: "/pipelines",
    label: "Pipelines",
    match: (pathname: string) =>
      pathname === "/pipelines" || pathname.startsWith("/markets/")
  },
  {
    href: "/agent-runs",
    label: "Agent Runs",
    match: (pathname: string) => pathname === "/agent-runs"
  }
] as const;

export function AppNav(): ReactNode {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Dashboard sections">
      {navItems.map((item) => {
        const isActive = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "site-nav-active" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
