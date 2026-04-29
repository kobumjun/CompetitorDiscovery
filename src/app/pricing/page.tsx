import type { Metadata } from "next";
import PricingClientPage from "./pricing-client-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ProposalPilot pricing plans. Start free with 5 credits. Pro plan $19/month, Agency plan $49/month.",
};

export default function PricingPage() {
  return <PricingClientPage />;
}
