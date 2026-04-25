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
const ABS_MAX = 20;

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
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={disabled || value <= MIN}
        onClick={() => onChange(clamp(value - 1))}
        aria-label="Decrease count"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold transition-colors select-none",
          "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100",
          (disabled || value <= MIN) && "opacity-35 cursor-not-allowed hover:bg-transparent active:bg-transparent"
        )}
      >
        <Minus className="h-4 w-4" />
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
          "h-10 w-12 rounded-lg border border-orange-200 bg-white text-center text-lg font-bold text-ink-900 outline-none transition-colors",
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
          "flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold transition-colors select-none",
          "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100",
          (disabled || value >= effectiveMax) &&
            "opacity-35 cursor-not-allowed hover:bg-transparent active:bg-transparent"
        )}
      >
        <Plus className="h-4 w-4" />
      </button>

      {maxCredits !== null && effectiveMax < ABS_MAX && (
        <span className="ml-2 text-xs text-amber-600">max {effectiveMax} (limited by credits)</span>
      )}
    </div>
  );
}
