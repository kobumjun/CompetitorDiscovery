export interface User {
  id: string;
  email: string;
  credits: number;
  plan: PlanType;
  plan_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanType = "free" | "pro" | "agency";

export const INITIAL_FREE_CREDITS = 5;

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  logo_url: string | null;
  industry: string | null;
  services: string[];
  hourly_rate: number | null;
  currency: string;
  tone: ProposalTone;
  language: string;
  payment_terms: string | null;
  standard_terms: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalTone = "professional" | "friendly" | "casual";

export interface Client {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired";

export interface ProposalContent {
  coverLetter: string;
  scope: { title: string; description: string }[];
  deliverables: string[];
  timeline: { phase: string; description: string }[];
  pricing: { item: string; description: string; amount: number }[];
  totalAmount: number;
  terms: string;
  nextSteps: string;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  project_name: string | null;
  status: ProposalStatus;
  project_description: string;
  estimated_budget: number | null;
  estimated_timeline: string | null;
  content: ProposalContent;
  share_token: string;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  signature_data: string | null;
  currency: string;
  total_amount: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
}

export interface ProposalActivity {
  id: string;
  proposal_id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  content: ProposalContent;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  lemon_squeezy_subscription_id: string;
  plan: PlanType;
  status: "active" | "cancelled" | "expired" | "past_due";
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export const PLAN_MONTHLY_CREDITS = {
  pro: 50,
  agency: 200,
} as const;

export function planIncludedCredits(plan: PlanType): number {
  switch (plan) {
    case "pro":
      return PLAN_MONTHLY_CREDITS.pro;
    case "agency":
      return PLAN_MONTHLY_CREDITS.agency;
    default:
      return INITIAL_FREE_CREDITS;
  }
}

export interface PlanConfig {
  name: string;
  type: PlanType;
  price: number;
  credits: number;
  pricePerCredit: string;
  features: string[];
  popular?: boolean;
  variantIdEnvKey: string;
}

export const PLANS: PlanConfig[] = [
  {
    name: "Pro",
    type: "pro",
    price: 19,
    credits: PLAN_MONTHLY_CREDITS.pro,
    pricePerCredit: "$0.38",
    popular: true,
    variantIdEnvKey: "LEMONSQUEEZY_PRO_VARIANT_ID",
    features: [
      "50 proposals / month",
      "AI proposal generation (GPT-4o)",
      "Unlimited clients",
      "Electronic signatures",
      "Shareable proposal links",
      "View & engagement tracking",
      "PDF export / print",
      "Custom branding",
    ],
  },
  {
    name: "Agency",
    type: "agency",
    price: 49,
    credits: PLAN_MONTHLY_CREDITS.agency,
    pricePerCredit: "$0.25",
    variantIdEnvKey: "LEMONSQUEEZY_AGENCY_VARIANT_ID",
    features: [
      "200 proposals / month",
      "Everything in Pro",
      "Priority AI generation",
      "Custom templates library",
      "Bulk proposal management",
      "Priority support",
    ],
  },
];

export const INDUSTRIES = [
  "Web Design",
  "Marketing",
  "Consulting",
  "Photography",
  "Development",
  "Copywriting",
  "Videography",
  "Translation",
  "Other",
] as const;

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "KRW", symbol: "₩", name: "Korean Won" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
] as const;

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || "$";
}

export function formatCurrency(amount: number, currency: string): string {
  const sym = getCurrencySymbol(currency);
  return `${sym}${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
