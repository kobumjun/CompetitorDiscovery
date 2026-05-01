/**
 * One-time credit packs shown on /pricing (One-time tab).
 *
 * Lemon Squeezy checkout uses one-time payment variants — configure IDs in env:
 * - LEMONSQUEEZY_ONETIME_STARTER_VARIANT_ID
 * - LEMONSQUEEZY_ONETIME_GROWTH_VARIANT_ID
 * - LEMONSQUEEZY_ONETIME_BULK_VARIANT_ID
 *
 * TODO: Add Lemon Squeezy variant ID (per pack) in Lemon dashboard + .env.local
 */
export type OnetimePackId = "starter" | "growth" | "bulk";

export type OneTimePackConfig = {
  id: OnetimePackId;
  name: string;
  priceUsd: number;
  credits: number;
  /** Display only, e.g. "$0.18/credit" */
  pricePerCreditLabel: string;
  badge: "popular" | "best" | null;
  features: string[];
};

export const ONE_TIME_PACKS: OneTimePackConfig[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 9,
    credits: 50,
    pricePerCreditLabel: "$0.18/credit",
    badge: null,
    features: [
      "50 email credits",
      "AI-powered search",
      "AI email writing",
      "No expiration",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceUsd: 19,
    credits: 150,
    pricePerCreditLabel: "$0.127/credit",
    badge: "popular",
    features: [
      "150 email credits",
      "AI-powered search",
      "AI email writing",
      "No expiration",
    ],
  },
  {
    id: "bulk",
    name: "Bulk",
    priceUsd: 39,
    credits: 400,
    pricePerCreditLabel: "$0.098/credit",
    badge: "best",
    features: [
      "400 email credits",
      "AI-powered search",
      "AI email writing",
      "No expiration",
    ],
  },
];
