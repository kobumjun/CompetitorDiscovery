import Link from "next/link";

const link = "text-sm text-ink-400 hover:text-ink-700 transition-colors";

type Props = {
  variant?: "default" | "sidebar";
};

export function SiteFooter({ variant = "default" }: Props) {
  if (variant === "sidebar") {
    return (
      <nav className="pt-3 mt-2 border-t border-surface-100 flex flex-col gap-1.5">
        <Link href="/terms" className="text-[11px] text-ink-400 hover:text-brand-600">
          Terms of Service
        </Link>
        <Link href="/refund-policy" className="text-[11px] text-ink-400 hover:text-brand-600">
          Refund Policy
        </Link>
        <Link href="/contact" className="text-[11px] text-ink-400 hover:text-brand-600">
          Contact
        </Link>
      </nav>
    );
  }

  return (
    <div className="border-t border-surface-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-ink-400 order-2 sm:order-1">
          &copy; {new Date().getFullYear()} ProposalPilot
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 order-1 sm:order-2">
          <Link href="/terms" className={link}>Terms of Service</Link>
          <Link href="/refund-policy" className={link}>Refund Policy</Link>
          <Link href="/contact" className={link}>Contact</Link>
        </nav>
      </div>
    </div>
  );
}
