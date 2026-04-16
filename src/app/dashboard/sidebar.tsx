"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Crosshair,
  LayoutDashboard,
  Clock,
  Settings,
  LogOut,
  CreditCard,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { planIncludedCredits } from "@/types";
import { SiteFooter } from "@/components/site-footer";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/history", icon: Clock, label: "History", exact: false },
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

  const maxCredits = planIncludedCredits(user.plan);
  const creditPercentage = Math.min((user.credits / maxCredits) * 100, 100);

  return (
    <aside className="w-64 h-screen bg-white border-r border-surface-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-surface-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Crosshair className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
          <span className="text-lg font-bold text-ink-900">ThreadScope</span>
        </Link>
      </div>

      {/* Navigation */}
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

      {/* Bottom Section */}
      <div className="p-4 space-y-3 border-t border-surface-200">
        {/* Credits */}
        <div className="bg-surface-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-brand-500" />
              Credits
            </span>
            <span className="text-xs font-bold text-ink-900">
              {user.credits}
              <span className="text-ink-400 font-normal">/{maxCredits}</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                creditPercentage > 50
                  ? "bg-brand-500"
                  : creditPercentage > 20
                  ? "bg-amber-500"
                  : "bg-red-500"
              )}
              style={{ width: `${creditPercentage}%` }}
            />
          </div>
        </div>

        {/* Upgrade */}
        {(user.plan === "free" || user.plan === "lite") && (
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Upgrade Plan
          </Link>
        )}

        {/* User & Sign Out */}
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
