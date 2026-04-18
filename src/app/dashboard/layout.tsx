import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "./sidebar";
import { MobileDashboardNav } from "./mobile-dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const userProfile = profile || {
    id: user.id,
    email: user.email!,
    credits: 0,
    plan: "free" as const,
    plan_expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="dashboard-layout">
      <DashboardSidebar user={userProfile} />
      <main className="dashboard-main">{children}</main>
      <MobileDashboardNav />
    </div>
  );
}
