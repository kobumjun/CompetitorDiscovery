import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCreditsForPlan } from "@/lib/credits";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch {
    return false;
  }
}

/** Map Lemon custom_data + subscription.user_email → Supabase users.id */
async function resolveSubscriptionUserId(
  serviceClient: SupabaseClient,
  meta: { custom_data?: Record<string, unknown> },
  subscriptionAttrs: { user_email?: string }
): Promise<string | null> {
  const custom = meta?.custom_data as Record<string, string> | undefined;
  if (custom?.user_id) return String(custom.user_id);

  const emailRaw =
    custom?.email || subscriptionAttrs?.user_email || "";
  const email = emailRaw.trim().toLowerCase();
  if (!email) return null;

  const { data } = await serviceClient
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || "";
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventName = event.meta?.event_name;
    const subscriptionData = event.data?.attributes;

    const serviceClient = await createServiceClient();
    const userId = await resolveSubscriptionUserId(
      serviceClient,
      event.meta ?? {},
      subscriptionData ?? {}
    );

    const needsUser = [
      "subscription_created",
      "subscription_updated",
      "subscription_payment_success",
      "subscription_expired",
    ].includes(eventName);

    if (needsUser && !userId) {
      console.warn(
        "[Lemon webhook] Skipping event: could not resolve user",
        eventName,
        subscriptionData?.user_email
      );
      return NextResponse.json({ received: true, skipped: true });
    }

    switch (eventName) {
      case "subscription_created": {
        const plan = determinePlan(subscriptionData?.variant_id);
        const credits = getCreditsForPlan(plan);

        await serviceClient.from("subscriptions").upsert(
          {
            user_id: userId!,
            lemon_squeezy_subscription_id: String(event.data.id),
            plan,
            status: "active",
            current_period_end: subscriptionData?.renews_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lemon_squeezy_subscription_id" }
        );

        await serviceClient
          .from("users")
          .update({
            plan,
            credits,
            plan_expires_at: subscriptionData?.renews_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId!);

        break;
      }

      case "subscription_updated": {
        const plan = determinePlan(subscriptionData?.variant_id);

        await serviceClient
          .from("subscriptions")
          .update({
            plan,
            status:
              subscriptionData?.status === "active" ? "active" : "cancelled",
            current_period_end: subscriptionData?.renews_at,
            updated_at: new Date().toISOString(),
          })
          .eq("lemon_squeezy_subscription_id", String(event.data.id));

        await serviceClient
          .from("users")
          .update({
            plan,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId!);

        break;
      }

      case "subscription_cancelled": {
        await serviceClient
          .from("subscriptions")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("lemon_squeezy_subscription_id", String(event.data.id));

        break;
      }

      case "subscription_payment_success": {
        const plan = determinePlan(subscriptionData?.variant_id);
        const credits = getCreditsForPlan(plan);

        await serviceClient
          .from("users")
          .update({
            credits,
            plan_expires_at: subscriptionData?.renews_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId!);

        break;
      }

      case "subscription_expired": {
        await serviceClient
          .from("subscriptions")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("lemon_squeezy_subscription_id", String(event.data.id));

        await serviceClient
          .from("users")
          .update({
            plan: "free",
            credits: 0,
            plan_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId!);

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

function determinePlan(variantId: number | string | undefined): string {
  const vid = String(variantId);
  if (vid === process.env.LEMONSQUEEZY_LITE_VARIANT_ID) return "lite";
  if (vid === process.env.LEMONSQUEEZY_STANDARD_VARIANT_ID) return "standard";
  if (vid === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) return "pro";
  return "lite";
}
