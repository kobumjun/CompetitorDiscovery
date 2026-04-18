export const OFFER_CATEGORIES = [
  "SaaS / Software Tool",
  "Insurance",
  "Financial Product",
  "Education / Coaching",
  "Consulting",
  "Physical Product",
  "Agency Service",
  "Other",
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number];

export interface UserOffer {
  offer_categories: OfferCategory[];
  product_name: string;
  value_proposition: string;
  target_keywords: string[];
}

export interface User {
  id: string;
  email: string;
  credits: number;
  plan: PlanType;
  plan_expires_at: string | null;
  offer_categories: OfferCategory[];
  product_name: string;
  value_proposition: string;
  target_keywords: string[];
  created_at: string;
  updated_at: string;
}

export type PlanType = "free" | "lite" | "standard" | "pro";

export const INITIAL_FREE_CREDITS = 3;

export interface Analysis {
  id: string;
  user_id: string;
  post_url: string;
  post_id: string;
  status: AnalysisStatus;
  results: AnalysisResult | null;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
}

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalysisResult {
  threadInfo: ThreadInfo;
  offerContext: { productName: string; categories: string[] } | null;
  leadSummary: LeadSummary;
  briefing: LeadBriefing;
  leads: Lead[];
  intentBreakdown: IntentBreakdownItem[];
  problemCategories: ProblemCategoryBreakdownItem[];
  outreachAngles: OutreachAngleItem[];
  draftMessages: DraftMessageItem[];
}

export interface ThreadInfo {
  author: string;
  authorHandle: string;
  content: string;
  repliesAnalyzed: number;
  totalEngagement: number;
  analyzedAt: string;
}

export type IntentType =
  | "looking_for_service"
  | "asking_for_recommendation"
  | "expressing_pain_point"
  | "comparing_tools"
  | "actively_evaluating"
  | "potential_future_need";

export type ProblemCategory =
  | "web_development"
  | "design"
  | "automation"
  | "ai_tooling"
  | "marketing"
  | "lead_generation"
  | "operations"
  | "other";

export type LeadScoreBand = "high" | "medium" | "low";

export interface LeadSummary {
  totalLeads: number;
  highIntentLeads: number;
  mediumIntentLeads: number;
  lowIntentLeads: number;
}

export interface LeadBriefing {
  summary: string;
  keySignals: string[];
  recommendedNextActions: string[];
}

export type OfferRelevanceBand = "relevant" | "partial" | "low";

export interface Lead {
  displayName: string;
  handle: string;
  quotedText: string;
  leadScore: number;
  scoreBand: LeadScoreBand;
  intentType: IntentType;
  problemCategory: ProblemCategory;
  suggestedOutreachAngle: string;
  profileLink: string;
  postLink: string | null;
  outreachDraft: string | null;
  offerRelevanceScore: number;
  offerRelevanceBand: OfferRelevanceBand;
  relevanceReason: string;
  customPitchMessage: string | null;
}

export interface IntentBreakdownItem {
  intentType: IntentType;
  count: number;
  percentage: number;
}

export interface ProblemCategoryBreakdownItem {
  category: ProblemCategory;
  count: number;
  percentage: number;
}

export interface OutreachAngleItem {
  angle: string;
  whyItWorks: string;
  bestForIntentTypes: IntentType[];
}

export interface DraftMessageItem {
  leadHandle: string;
  intentType: IntentType;
  channel: "dm" | "email";
  message: string;
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

/** Monthly analyses included per paid plan (single source of truth with `getCreditsForPlan`). */
export const PLAN_MONTHLY_CREDITS = {
  lite: 60,
  standard: 190,
  pro: 560,
} as const;

export function planIncludedCredits(plan: PlanType): number {
  switch (plan) {
    case "lite":
      return PLAN_MONTHLY_CREDITS.lite;
    case "standard":
      return PLAN_MONTHLY_CREDITS.standard;
    case "pro":
      return PLAN_MONTHLY_CREDITS.pro;
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
    name: "Lite",
    type: "lite",
    price: 29,
    credits: PLAN_MONTHLY_CREDITS.lite,
    pricePerCredit: "$0.48",
    variantIdEnvKey: "LEMONSQUEEZY_LITE_VARIANT_ID",
    features: [
      "60 thread analyses / month",
      "Lead extraction from public threads",
      "Buyer intent scoring (high/medium/low)",
      "Outreach angle suggestions",
      "7-day history retention",
    ],
  },
  {
    name: "Standard",
    type: "standard",
    price: 79,
    credits: PLAN_MONTHLY_CREDITS.standard,
    pricePerCredit: "$0.42",
    popular: true,
    variantIdEnvKey: "LEMONSQUEEZY_STANDARD_VARIANT_ID",
    features: [
      "190 thread analyses / month",
      "Lead extraction from public threads",
      "Buyer intent scoring (high/medium/low)",
      "Intent + problem category breakdown",
      "Outreach angle suggestions",
      "Draft DM suggestions",
      "30-day history retention",
      "Export to CSV / JSON",
    ],
  },
  {
    name: "Pro",
    type: "pro",
    price: 149,
    credits: PLAN_MONTHLY_CREDITS.pro,
    pricePerCredit: "$0.27",
    variantIdEnvKey: "LEMONSQUEEZY_PRO_VARIANT_ID",
    features: [
      "560 thread analyses / month",
      "Lead extraction from public threads",
      "Buyer intent scoring (high/medium/low)",
      "Intent + problem category breakdown",
      "Outreach angle suggestions",
      "Draft DM suggestions",
      "Priority lead scoring",
      "Unlimited history retention",
      "Export to CSV / JSON",
      "Priority processing",
      "API access (coming soon)",
    ],
  },
];

export interface ThreadData {
  originalPost: {
    id: string;
    text: string;
    author: string;
    authorHandle: string;
    createdAt: string;
    metrics: {
      likes: number;
      retweets: number;
      replies: number;
    };
  };
  replies: ThreadReply[];
}

export interface ThreadReply {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  createdAt: string;
  urls: string[];
}
