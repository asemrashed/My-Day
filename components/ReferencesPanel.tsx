"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReferencePicker, { type ReferenceTarget } from "@/components/ReferencePicker";
import { CreditCard, Target, CheckSquare, FileText, Link2, X, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

type HydratedLink = {
  id: string;
  targetType: string;
  targetId: string;
  target: Record<string, any> | null;
};

interface ReferencesPanelProps {
  sourceType: "NOTE" | "GOAL" | "TASK";
  sourceId: string;
}

const TARGET_PAGES: Record<string, string> = {
  TRANSACTION: "/expenses",
  GOAL: "/goals",
  TASK: "/tasks",
  NOTE: "/notes",
};

const TARGET_ICONS: Record<string, typeof CreditCard> = {
  TRANSACTION: CreditCard,
  GOAL: Target,
  TASK: CheckSquare,
  NOTE: FileText,
};

export default function ReferencesPanel({ sourceType, sourceId }: ReferencesPanelProps) {
  const [links, setLinks] = useState<HydratedLink[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const fetchLinks = useCallback(() => {
    fetch(`/api/links?sourceType=${sourceType}&sourceId=${sourceId}`)
      .then((r) => r.json())
      .then((data) => setLinks(Array.isArray(data) ? data : []))
      .catch(() => setLinks([]));
  }, [sourceType, sourceId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAttach = async (targets: ReferenceTarget[]) => {
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId, targets }),
      });
      if (res.ok) {
        toast.success("References attached!");
        fetchLinks();
      } else {
        toast.error("Failed to attach references");
      }
    } catch {
      toast.error("Failed to attach references");
    }
  };

  const handleRemove = async (linkId: string) => {
    try {
      const res = await fetch(`/api/links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        toast.success("Reference removed");
      }
    } catch {
      toast.error("Failed to remove reference");
    }
  };

  const txLinks = links.filter((l) => l.targetType === "TRANSACTION" && l.target);
  const txTotal = txLinks.reduce(
    (sum, l) => sum + (l.target!.type === "EXPENSE" ? l.target!.amount : -l.target!.amount),
    0
  );

  const renderTargetLabel = (link: HydratedLink) => {
    const t = link.target;
    if (!t) return <span className="italic text-muted-foreground">Deleted item</span>;

    switch (link.targetType) {
      case "TRANSACTION":
        return (
          <span className="flex items-center gap-2 min-w-0">
            <span className={`font-bold tabular-nums shrink-0 ${t.type === "EXPENSE" ? "text-rose-500" : "text-emerald-500"}`}>
              {t.type === "EXPENSE" ? "-" : "+"}৳{Number(t.amount).toLocaleString()}
            </span>
            <span className="truncate text-muted-foreground">
              {t.category}
              {t.note ? ` · ${t.note}` : ""} · {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </span>
        );
      case "GOAL":
        return (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate font-semibold">{t.title}</span>
            <span className="shrink-0 text-muted-foreground">{t.progress}%{t.isCompleted ? " · done" : ""}</span>
          </span>
        );
      case "TASK":
        return (
          <span className="flex items-center gap-2 min-w-0">
            <span className={`truncate font-semibold ${t.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
            <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{String(t.status).replace("_", " ")}</span>
          </span>
        );
      case "NOTE":
        return <span className="truncate font-semibold">{t.title || "Untitled Note"}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> References
          {links.length > 0 && <span className="tabular-nums">({links.length})</span>}
        </h4>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="text-[11px] font-bold text-primary hover:underline"
        >
          + Attach
        </button>
      </div>

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link) => {
            const Icon = TARGET_ICONS[link.targetType] || Link2;
            return (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/40 text-xs group"
              >
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">{renderTargetLabel(link)}</div>
                <Link
                  href={TARGET_PAGES[link.targetType] || "/"}
                  className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Open"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(link.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove reference"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {txLinks.length > 1 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/30 text-xs font-bold">
              <span>Expense total ({txLinks.length} items)</span>
              <span className="tabular-nums">
                ৳{Math.abs(txTotal).toLocaleString()} {txTotal >= 0 ? "spent" : "net earned"}
              </span>
            </div>
          )}
        </div>
      )}

      <ReferencePicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onAttach={handleAttach}
        excludeIds={[sourceId]}
      />
    </div>
  );
}
