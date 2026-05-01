export type PaidPlan = "pro" | "agency";

/** One-time Lemon Squeezy packs (separate variants from subscription). */
export type OnetimePack = "starter" | "growth" | "bulk";

export function getOnetimeVariantId(pack: OnetimePack): string | undefined {
  const raw =
    pack === "starter"
      ? process.env.LEMONSQUEEZY_ONETIME_STARTER_VARIANT_ID
      : pack === "growth"
        ? process.env.LEMONSQUEEZY_ONETIME_GROWTH_VARIANT_ID
        : process.env.LEMONSQUEEZY_ONETIME_BULK_VARIANT_ID;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function getVariantIdForPlan(plan: PaidPlan): string | undefined {
  const id =
    plan === "pro"
      ? process.env.LEMONSQUEEZY_PRO_VARIANT_ID
      : process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID;
  const trimmed = id?.trim();
  return trimmed || undefined;
}

export async function createLemonCheckout(params: {
  storeId: string;
  variantId: string;
  apiKey: string;
  checkoutData?: {
    email?: string;
    custom?: Record<string, string>;
  };
  redirectUrl: string;
}): Promise<string> {
  const attributes: Record<string, unknown> = {
    product_options: {
      redirect_url: params.redirectUrl,
    },
  };

  if (
    params.checkoutData &&
    (params.checkoutData.email || params.checkoutData.custom)
  ) {
    const custom =
      params.checkoutData.custom &&
      Object.keys(params.checkoutData.custom).length > 0
        ? params.checkoutData.custom
        : undefined;
    attributes.checkout_data = {
      ...(params.checkoutData.email ? { email: params.checkoutData.email } : {}),
      ...(custom ? { custom } : {}),
    };
  }

  const body = {
    data: {
      type: "checkouts",
      attributes,
      relationships: {
        store: {
          data: { type: "stores", id: String(params.storeId) },
        },
        variant: {
          data: { type: "variants", id: String(params.variantId) },
        },
      },
    },
  };

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Lemon Squeezy ${res.status}: ${text}`);
  }

  const json = JSON.parse(text) as {
    data?: { attributes?: { url?: string } };
  };
  const url = json.data?.attributes?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Lemon Squeezy response missing checkout URL");
  }
  return url;
}
