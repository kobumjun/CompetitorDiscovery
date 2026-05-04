"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailCountStepperProps {
  value: number;
  onChange: (value: number) => void;
  maxCredits: number | null;
  disabled?: boolean;
  className?: string;
}

const MIN = 1;
const ABS_MAX = 10;

export function EmailCountStepper({
  value,
  onChange,
  maxCredits,
  disabled = false,
  className,
}: EmailCountStepperProps) {
  const effectiveMax = maxCredits !== null ? Math.min(ABS_MAX, Math.max(MIN, maxCredits)) : ABS_MAX;

  function clamp(n: number) {
    return Math.min(effectiveMax, Math.max(MIN, n));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      onChange(MIN);
      return;
    }
    onChange(clamp(Number(raw)));
  }

  function handleBlur() {
    onChange(clamp(value));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1 md:gap-1.5", className)}>
      <button
        type="button"
        disabled={disabled || value <= MIN}
        onClick={() => onChange(clamp(value - 1))}
        aria-label="Decrease count"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-base font-semibold transition-colors select-none md:h-10 md:w-10 md:text-lg",
          "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100",
          (disabled || value <= MIN) && "opacity-35 cursor-not-allowed hover:bg-transparent active:bg-transparent"
        )}
      >
        <Minus className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className={cn(
          "h-8 w-10 rounded-lg border border-orange-200 bg-white text-center text-base font-bold text-ink-900 outline-none transition-colors md:h-10 md:w-12 md:text-lg",
          "focus:border-orange-400 focus:ring-2 focus:ring-orange-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />

      <button
        type="button"
        disabled={disabled || value >= effectiveMax}
        onClick={() => onChange(clamp(value + 1))}
        aria-label="Increase count"
        title={
          maxCredits !== null && value >= effectiveMax && effectiveMax < ABS_MAX
            ? `You have ${maxCredits} credits`
            : undefined
        }
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-base font-semibold transition-colors select-none md:h-10 md:w-10 md:text-lg",
          "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100",
          (disabled || value >= effectiveMax) &&
            "opacity-35 cursor-not-allowed hover:bg-transparent active:bg-transparent"
        )}
      >
        <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </button>

      {maxCredits !== null && effectiveMax < ABS_MAX && (
        <span className="ml-1 shrink-0 text-[11px] text-amber-600 md:ml-2 md:text-xs">
          <span className="md:hidden">max {effectiveMax}</span>
          <span className="hidden md:inline">max {effectiveMax} (limited by credits)</span>
        </span>
      )}
    </div>
  );
}
