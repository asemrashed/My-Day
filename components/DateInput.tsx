"use client";

import React, { useRef } from "react";
import { Calendar } from "lucide-react";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Date input with a always-visible calendar control (native picker icon
 * is unreliable in dark mode across browsers).
 */
export default function DateInput({ className = "", onClick, ...props }: DateInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = ref.current;
    if (!el || props.disabled) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative w-full date-input-wrap">
      <input
        ref={ref}
        type="date"
        {...props}
        onClick={(e) => {
          onClick?.(e);
          openPicker();
        }}
        className={`app-input pr-10 date-input ${className}`.trim()}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={props.disabled}
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded-md text-foreground hover:text-primary hover:bg-muted/60 transition-colors disabled:opacity-40"
        title="Pick a date"
        aria-label="Pick a date"
      >
        <Calendar className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
