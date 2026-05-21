import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Big Banana Dashboard",
  description: "Trading pipeline monitor for MVP validation"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
