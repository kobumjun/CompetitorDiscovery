import type { Metadata } from "next";
import SignupPageClient from "./signup-page-client";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create your free ProposalPilot account. 10 credits included, no credit card required.",
};

export default function SignupPage() {
  return <SignupPageClient />;
}
