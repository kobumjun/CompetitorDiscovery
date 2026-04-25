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
        <Link href="/privacy" className="text-[11px] text-ink-400 hover:text-brand-600">
          Privacy Policy
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
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <p className="text-sm text-ink-400">
          &copy; {new Date().getFullYear()} ProposalPilot
        </p>
        <div className="grid grid-cols-2 gap-x-10 gap-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-800 mb-2">Legal</p>
            <nav className="flex flex-col gap-2">
              <Link href="/terms" className={link}>Terms of Service</Link>
              <Link href="/privacy" className={link}>Privacy Policy</Link>
              <Link href="/refund-policy" className={link}>Refund Policy</Link>
              <Link href="/contact" className={link}>Contact</Link>
            </nav>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-800 mb-2">Resources</p>
            <nav className="flex flex-col gap-2">
              <Link href="/faq" className={link}>FAQ</Link>
              <Link href="/what-is-proposalpilot" className={link}>What is ProposalPilot?</Link>
              <Link href="/compare" className={link}>Compare</Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
