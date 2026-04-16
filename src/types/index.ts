export interface User {
  id: string;
  email: string;
  credits: number;
  plan: PlanType;
  plan_expires_at: string | null;
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
  marketBriefing: MarketBriefing;
  competitors: Competitor[];
  categories: MarketCategory[];
  marketNeeds: MarketNeed[];
  positioningPatterns: PositioningPattern[];
  differentiationOpportunities: DifferentiationOpportunity[];
  productIdeas: ProductIdea[];
}

export interface ThreadInfo {
  author: string;
  authorHandle: string;
  content: string;
  repliesAnalyzed: number;
  totalEngagement: number;
  analyzedAt: string;
}

export interface MarketBriefing {
  summary: string;
  keyTakeaways: string[];
  marketSentiment: "bullish" | "bearish" | "neutral" | "mixed";
  emergingTrends: string[];
  threatLevel: "low" | "moderate" | "high" | "critical";
}

export interface Competitor {
  name: string;
  description: string;
  url: string | null;
  category: string;
  stage: "idea" | "building" | "launched" | "growing" | "established";
  positioning: string;
  mentionCount: number;
  tags: string[];
}

export interface MarketCategory {
  name: string;
  count: number;
  percentage: number;
  examples: string[];
  trend: "rising" | "stable" | "declining";
}

export interface MarketNeed {
  need: string;
  frequency: "very_common" | "common" | "occasional" | "rare";
  urgency: "critical" | "high" | "medium" | "low";
  relatedProducts: string[];
  opportunityNote: string;
}

export interface PositioningPattern {
  pattern: string;
  description: string;
  examples: string[];
  effectiveness: "strong" | "moderate" | "weak";
  saturation: "oversaturated" | "competitive" | "open";
}

export interface DifferentiationOpportunity {
  opportunity: string;
  rationale: string;
  difficulty: "easy" | "medium" | "hard";
  potentialImpact: "high" | "medium" | "low";
  suggestedApproach: string;
}

export interface ProductIdea {
  idea: string;
  description: string;
  targetAudience: string;
  marketGap: string;
  competitiveAdvantage: string;
  estimatedDifficulty: "low" | "medium" | "high";
  revenueModel: string;
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
      "Full competitor mapping",
      "Market briefing reports",
      "Category & trend analysis",
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
      "Full competitor mapping",
      "Market briefing reports",
      "Category & trend analysis",
      "Positioning pattern detection",
      "Product idea generation",
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
      "Full competitor mapping",
      "Market briefing reports",
      "Category & trend analysis",
      "Positioning pattern detection",
      "Product idea generation",
      "Differentiation opportunities",
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
