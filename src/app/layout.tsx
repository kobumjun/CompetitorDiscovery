import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProposalPilot — Extract Emails & Send AI-Powered Outreach",
    template: "%s | ProposalPilot",
  },
  description:
    "Paste any website URL, extract contact emails automatically, and send personalized proposals, pitches, and investment asks using AI. Under 60 seconds.",
  keywords: [
    "cold outreach",
    "email extraction",
    "AI proposals",
    "sales pitch",
    "lead generation",
    "cold email",
    "business proposals",
    "outreach automation",
  ],
  authors: [{ name: "ProposalPilot" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://competitor-discovery-chi.vercel.app",
    siteName: "ProposalPilot",
    title: "ProposalPilot — Extract Emails & Send AI-Powered Outreach",
    description:
      "Paste any website URL, extract contact emails, and send personalized proposals, pitches, and investment asks using AI. Under 60 seconds.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProposalPilot — Extract Emails & Send AI-Powered Outreach",
    description:
      "Paste any website URL, extract contact emails, and send personalized outreach using AI.",
  },
  robots: {
    index: true,
    follow: true,
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
