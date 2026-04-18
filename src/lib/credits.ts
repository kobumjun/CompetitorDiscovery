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
