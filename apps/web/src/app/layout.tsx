import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICP Lead Engine",
  description: "ICP-qualified leads from the people engaging with your competitors on LinkedIn.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
