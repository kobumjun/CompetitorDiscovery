import type { Metadata } from "next";
import LoginPageClient from "./login-page-client";

export const metadata: Metadata = {
  title: "Log In",
  description:
    "Log in to ProposalPilot and start extracting emails and sending AI-powered outreach.",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
