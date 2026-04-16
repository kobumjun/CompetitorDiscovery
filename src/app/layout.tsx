import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThreadScope — Lead Extraction from X Threads",
  description:
    "Turn any public X thread into outreach-ready leads. Detect buyer intent, prioritize prospects, and send better outreach faster.",
  keywords: [
    "lead extraction",
    "buyer intent",
    "X threads",
    "Twitter threads",
    "outreach",
    "prospecting",
    "sales intelligence",
  ],
  openGraph: {
    title: "ThreadScope — Lead Extraction from X Threads",
    description:
      "Turn any public X thread into outreach-ready leads.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
