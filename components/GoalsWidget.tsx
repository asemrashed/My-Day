"use client";

import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";
import { useGoalsPreview } from "@/hooks/useAppQueries";

export default function GoalsWidget() {
  const { data: goals = [] } = useGoalsPreview(3);

  const periodLabelMap: Record<string, string> = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    YEARLY: "Yearly",
    CUSTOM: "Custom",
  };

  return (
    <div className="app-card relative overflow-hidden flex flex-col justify-between p-6">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Target className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-sm text-foreground">Active Goals</h4>
        </div>

        {goals.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-left">
            No goals tracked yet. Map your targets and track your checklist progress!
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((g) => (
              <div key={g.id} className="flex flex-col gap-1.5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-foreground truncate max-w-[70%]">{g.title}</span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground shrink-0">
                    {periodLabelMap[g.period] || g.period}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground w-8 text-right shrink-0">{g.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/40">
        <Link
          href="/goals"
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-muted/60 border border-border/80 rounded-xl hover:bg-muted text-xs text-foreground font-semibold transition-all active:scale-[0.98]"
        >
          Manage Goal Trackers
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
