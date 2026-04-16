import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "./sidebar";

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
    <div className="flex h-screen bg-surface-50">
      <DashboardSidebar user={userProfile} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
