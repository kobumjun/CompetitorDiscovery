import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("lemon_squeezy_subscription_id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "cancelled", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.lemon_squeezy_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemon_squeezy_subscription_id}`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      console.error(
        "Lemon Squeezy subscription fetch failed:",
        res.status,
        await res.text()
      );
      return NextResponse.json(
        { error: "Failed to retrieve subscription details" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const portalUrl =
      json?.data?.attributes?.urls?.customer_portal ??
      json?.data?.attributes?.urls?.update_payment_method;

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Customer portal URL not available" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error("Subscription portal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
