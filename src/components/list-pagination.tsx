"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const LIST_PAGE_SIZE = 10;

function buildPageList(current: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, pageCount, current, current - 1, current + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p - sorted[i - 1]! > 1) {
      out.push("ellipsis");
    }
    out.push(p);
  }
  return out;
}

type ListPaginationProps = {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ListPagination({
  page,
  totalItems,
  pageSize = LIST_PAGE_SIZE,
  onPageChange,
  className,
}: ListPaginationProps) {
  if (totalItems <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const pages = buildPageList(safePage, pageCount);

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-xs text-ink-500 tabular-nums">
        Showing {start}-{end} of {totalItems}
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-white text-ink-600 transition-colors hover:bg-surface-50 disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-ink-400 select-none">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                "min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums transition-colors",
                item === safePage
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-ink-600 hover:bg-surface-100"
              )}
              aria-current={item === safePage ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 bg-white text-ink-600 transition-colors hover:bg-surface-50 disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
