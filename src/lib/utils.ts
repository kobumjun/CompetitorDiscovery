import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractPostId(url: string): string | null {
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-emerald-600 bg-emerald-50";
    case "processing":
      return "text-amber-600 bg-amber-50";
    case "pending":
      return "text-slate-500 bg-slate-50";
    case "failed":
      return "text-red-600 bg-red-50";
    default:
      return "text-slate-500 bg-slate-50";
  }
}

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "text-emerald-600";
    case "bearish":
      return "text-red-600";
    case "mixed":
      return "text-amber-600";
    default:
      return "text-slate-500";
  }
}

export function getThreatColor(level: string): string {
  switch (level) {
    case "critical":
      return "text-red-600 bg-red-50 border-red-200";
    case "high":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "moderate":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "low":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200";
  }
}
