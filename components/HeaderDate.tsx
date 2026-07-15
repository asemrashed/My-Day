"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { formatBengaliDate, getTraditionalBengaliDate } from "@/lib/utils";

export default function HeaderDate() {
  const { english, bengali, traditional } = useMemo(() => {
    const today = new Date();
    return {
      english: today.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      bengali: formatBengaliDate(today),
      traditional: getTraditionalBengaliDate(today),
    };
  }, []);

  return (
    <div
      className="flex items-center gap-2 max-w-[140px] sm:max-w-[220px] md:max-w-none"
      title={`${english} · ${bengali} · ${traditional}`}
    >
      <CalendarDays className="h-4 w-4 text-primary shrink-0" />
      <div className="text-left leading-tight min-w-0">
        <p className="text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap truncate">
          {english}
        </p>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate hidden sm:block">
          {bengali}
        </p>
      </div>
    </div>
  );
}
