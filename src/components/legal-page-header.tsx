import Link from "next/link";
import { Crosshair } from "lucide-react";

export function LegalPageHeader() {
  return (
    <header className="border-b border-surface-200 bg-white">
      <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink-900">
          <Crosshair className="w-5 h-5 text-brand-500" strokeWidth={2.5} />
          ThreadScope
        </Link>
        <Link href="/dashboard" className="text-sm text-ink-500 hover:text-ink-800">
          Dashboard
        </Link>
      </div>
    </header>
  );
}
