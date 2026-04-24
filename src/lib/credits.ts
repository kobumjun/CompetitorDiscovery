import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_MONTHLY_CREDITS, type User } from "@/types";

export async function getUserCredits(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("credits")
    .eq("id", userId)
    .single();

  if (error) throw new Error("Failed to fetch user credits");
  return data.credits;
}

export async function deductCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; remaining: number }> {
  const supabase = await createServiceClient();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("credits")
    .eq("id", userId)
    .single();

  if (fetchError || !user) {
    return { success: false, remaining: 0 };
  }

  if (user.credits < amount) {
    return { success: false, remaining: user.credits };
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      credits: user.credits - amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("credits")
    .single();

  if (error) {
    return { success: false, remaining: user.credits };
  }

  return { success: true, remaining: data.credits };
}

export async function addCredits(
  userId: string,
  amount: number
): Promise<void> {
  const supabase = await createServiceClient();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("credits")
    .eq("id", userId)
    .single();

  if (fetchError || !user) throw new Error("User not found");

  await supabase
    .from("users")
    .update({
      credits: user.credits + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function compareAndSwapCredits(
  userId: string,
  update: (currentCredits: number) => number | null
): Promise<number | null> {
  const supabase = await createServiceClient();
  const maxRetries = 4;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (fetchError || !user) return null;

    const nextCredits = update(user.credits);
    if (nextCredits === null) return null;

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        credits: nextCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits", user.credits)
      .select("credits")
      .single();

    if (!updateError && updated) {
      return updated.credits;
    }
  }

  return null;
}

export async function reserveCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; remaining: number }> {
  if (amount <= 0) {
    const current = await getUserCredits(userId);
    return { success: true, remaining: current };
  }

  const result = await compareAndSwapCredits(userId, (current) => {
    if (current < amount) return null;
    return current - amount;
  });

  if (result === null) {
    const remaining = await getUserCredits(userId).catch(() => 0);
    return { success: false, remaining };
  }

  return { success: true, remaining: result };
}

export async function refundCredits(userId: string, amount: number): Promise<number | null> {
  if (amount <= 0) return getUserCredits(userId);
  return compareAndSwapCredits(userId, (current) => current + amount);
}

export async function getUserProfile(userId: string): Promise<User> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw new Error("Failed to fetch user profile");
  return data as User;
}

export function getCreditsForPlan(plan: string): number {
  switch (plan) {
    case "pro":
      return PLAN_MONTHLY_CREDITS.pro;
    case "agency":
      return PLAN_MONTHLY_CREDITS.agency;
    default:
      return 0;
  }
}
