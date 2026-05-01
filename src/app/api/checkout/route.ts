import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createLemonCheckout,
  getOnetimeVariantId,
  getVariantIdForPlan,
  type OnetimePack,
  type PaidPlan,
} from "@/lib/lemonsqueezy";

const PAID_PLANS: PaidPlan[] = ["pro", "agency"];
const ONETIME_PACKS: OnetimePack[] = ["starter", "growth", "bulk"];

function isPaidPlan(p: string): p is PaidPlan {
  return PAID_PLANS.includes(p as PaidPlan);
}

function isOnetimePack(p: string): p is OnetimePack {
  return ONETIME_PACKS.includes(p as OnetimePack);
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
    const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

    if (!apiKey || !storeId) {
      return NextResponse.json(
        { error: "Checkout is not configured (Lemon API key or store ID missing)." },
        { status: 503 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is required for post-checkout redirect." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const plan = body?.plan;
    const onetime = body?.onetime;

    const hasPlan = plan && typeof plan === "string" && isPaidPlan(plan);
    const hasOnetime = onetime && typeof onetime === "string" && isOnetimePack(onetime);

    if (hasPlan === hasOnetime) {
      return NextResponse.json(
        { error: "Send exactly one of: { plan: \"pro\" | \"agency\" } (subscription) or { onetime: \"starter\" | \"growth\" | \"bulk\" } (one-time)." },
        { status: 400 }
      );
    }

    const variantId = hasOnetime
      ? getOnetimeVariantId(onetime)
      : hasPlan
        ? getVariantIdForPlan(plan)
        : undefined;
    if (!variantId) {
      return NextResponse.json(
        {
          error: hasOnetime
            ? `Missing one-time variant env for "${onetime}" (e.g. LEMONSQUEEZY_ONETIME_${String(onetime).toUpperCase()}_VARIANT_ID).`
            : `Missing environment variable for ${plan} variant (e.g. LEMONSQUEEZY_${String(plan).toUpperCase()}_VARIANT_ID).`,
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const checkoutData: {
      email?: string;
      custom?: Record<string, string>;
    } = {};

    const custom: Record<string, string> = {};
    if (user?.id) custom.user_id = user.id;
    if (user?.email) {
      custom.email = user.email;
      checkoutData.email = user.email;
    }
    if (Object.keys(custom).length > 0) {
      checkoutData.custom = custom;
    }

    const redirectUrl = `${appUrl}/dashboard/settings?checkout=success`;

    const url = await createLemonCheckout({
      storeId,
      variantId,
      apiKey,
      redirectUrl,
      ...(Object.keys(checkoutData).length > 0 ? { checkoutData } : {}),
    });

    return NextResponse.json({ url });
  } catch (e) {
    console.error("Checkout error:", e);
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
