"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Rocket,
  LayoutDashboard,
  Sparkles,
  Settings,
  LogOut,
  CreditCard,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { planIncludedCredits } from "@/types";
import { SiteFooter } from "@/components/site-footer";
import { useDashboardCredits } from "@/lib/use-dashboard-credits";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/pricing", icon: Sparkles, label: "Pricing", exact: true },
  { href: "/dashboard/settings", icon: Settings, label: "Settings", exact: false },
];

export function DashboardSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const { data: liveCredits = user.credits } = useDashboardCredits(user.credits);
  const maxCredits = planIncludedCredits(user.plan);
  const creditPercentage = Math.min((liveCredits / maxCredits) * 100, 100);

  return (
    <aside className="dashboard-sidebar">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-surface-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Rocket className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
          <span className="text-lg font-bold text-ink-900">ProposalPilot</span>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500 ml-0 pl-[10px]"
                  : "text-ink-500 hover:text-ink-700 hover:bg-surface-100"
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px]", active ? "text-brand-600" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-3 border-t border-surface-200">
        <div className={cn(
          "rounded-lg p-3",
          liveCredits <= 3 && liveCredits > 0 ? "bg-amber-50" : liveCredits === 0 ? "bg-red-50" : "bg-surface-50"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-xs font-semibold flex items-center gap-1.5",
              liveCredits === 0 ? "text-red-600" : liveCredits <= 3 ? "text-amber-600" : "text-ink-500"
            )}>
              <Zap className={cn(
                "w-3.5 h-3.5",
                liveCredits === 0 ? "text-red-500" : liveCredits <= 3 ? "text-amber-500" : "text-brand-500"
              )} />
              Credits
            </span>
            <span className={cn(
              "text-xs font-bold",
              liveCredits === 0 ? "text-red-700" : liveCredits <= 3 ? "text-amber-700" : "text-ink-900"
            )}>
              {liveCredits}
              <span className="text-ink-400 font-normal">/{maxCredits}</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                creditPercentage > 50 ? "bg-brand-500" : creditPercentage > 20 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${creditPercentage}%` }}
            />
          </div>
          {liveCredits <= 3 && (
            <p className={cn(
              "text-[10px] mt-1.5",
              liveCredits === 0 ? "text-red-600" : "text-amber-600"
            )}>
              {liveCredits === 0 ? "No credits left!" : "Running low on credits!"}
            </p>
          )}
        </div>

        <Link
          href="/pricing"
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors",
            liveCredits <= 3
              ? "text-white bg-brand-500 hover:bg-brand-600"
              : "text-brand-700 bg-brand-50 hover:bg-brand-100"
          )}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Get More Credits
        </Link>

        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-400 truncate max-w-[160px]" title={user.email}>
            {user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <SiteFooter variant="sidebar" />
      </div>
    </aside>
  );
}
