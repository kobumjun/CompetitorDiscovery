"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

export const DASHBOARD_CREDITS_KEY = "dashboard-credits";

async function fetchDashboardCredits(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data } = await supabase
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  return data?.credits ?? 0;
}

export function useDashboardCredits(initialCredits?: number) {
  return useSWR(DASHBOARD_CREDITS_KEY, fetchDashboardCredits, {
    fallbackData: initialCredits,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
}
