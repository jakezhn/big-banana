import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "../src/ui/app-nav";
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
          <AppNav />
        </header>
        {children}
      </body>
    </html>
  );
}
