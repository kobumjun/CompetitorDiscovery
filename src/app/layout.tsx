import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProposalPilot — AI Proposal Generator",
  description:
    "Create winning proposals in 30 seconds, not 3 hours. AI-powered proposal generator for freelancers, agencies, and consultants.",
  keywords: [
    "proposal generator",
    "AI proposals",
    "freelancer tools",
    "agency proposals",
    "consulting proposals",
    "electronic signatures",
    "client management",
  ],
  openGraph: {
    title: "ProposalPilot — AI Proposal Generator",
    description:
      "Create winning proposals in 30 seconds. AI-powered for freelancers and agencies.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
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
