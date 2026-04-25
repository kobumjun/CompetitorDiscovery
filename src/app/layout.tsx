import type { Metadata } from "next";
import "./globals.css";

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ProposalPilot",
  url: "https://competitor-discovery-chi.vercel.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Extract contact emails from any website URL and generate personalized outreach using AI. Supports bulk extraction of up to 20 URLs at once.",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "5 free credits",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "19",
      priceCurrency: "USD",
      billingIncrement: "monthly",
      description: "150 credits per month",
    },
    {
      "@type": "Offer",
      name: "Agency",
      price: "49",
      priceCurrency: "USD",
      billingIncrement: "monthly",
      description: "500 credits per month",
    },
  ],
  featureList: [
    "Email extraction from any website URL",
    "Bulk Discovery — extract from up to 20 URLs at once",
    "AI-powered proposal generation using GPT-4o",
    "4 outreach types: Proposal, Sales Pitch, Investment Ask, Quote",
    "Sends from user's own email client",
    "Client management and CSV export",
  ],
};

export const metadata: Metadata = {
  title: {
    default: "ProposalPilot — Extract Emails & Send AI-Powered Outreach in 60 Seconds",
    template: "%s | ProposalPilot",
  },
  description:
    "Paste any website URL, extract the contact email, and generate a personalized pitch with AI. Built for freelancers, founders, and anyone who does their own outreach.",
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
    title: "ProposalPilot — Extract Emails & Send AI-Powered Outreach in 60 Seconds",
    description:
      "Paste any website URL, extract the contact email, and generate a personalized pitch with AI. Built for freelancers, founders, and anyone who does their own outreach.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProposalPilot — Extract Emails & Send AI-Powered Outreach in 60 Seconds",
    description:
      "Paste any website URL, extract the contact email, and generate a personalized pitch with AI.",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
      </head>
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
