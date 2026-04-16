import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThreadScope — Competitive Intelligence from X Threads",
  description:
    "Turn any X builder thread into structured market intelligence. Discover competitors, extract positioning patterns, and find product opportunities — all from a single URL.",
  keywords: [
    "competitive intelligence",
    "market research",
    "X threads",
    "Twitter threads",
    "competitor analysis",
    "builder threads",
    "product research",
    "market intelligence",
  ],
  openGraph: {
    title: "ThreadScope — Competitive Intelligence from X Threads",
    description:
      "Turn any X builder thread into structured market intelligence.",
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
