"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

type Note = {
  id: string;
  title?: string;
  content: string;
  attachments: string[];
  updatedAt: string;
};

export default function NotesWidget() {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);

  const latest = notes[0];

  // Helper to extract a clean text summary from HTML content for previews
  const getHtmlTextPreview = (html: string) => {
    if (!html) return "No content yet";
    // Strip tags
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.length > 180 ? text.slice(0, 180) + "..." : text || "Empty note";
  };

  return (
    <div className="app-card relative overflow-hidden flex flex-col justify-between p-6">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
      
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <FileText className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-sm text-foreground">Recent Notes</h4>
        </div>

        {!latest ? (
          <div className="text-xs text-muted-foreground py-6 text-left">
            No notes logged yet. Capture tasks, dev snippets, and specs here!
          </div>
        ) : (
          <div className="space-y-2 text-left">
            <div className="text-sm font-extrabold text-foreground truncate">
              {latest.title || "Untitled Note"}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {getHtmlTextPreview(latest.content)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/40">
        <Link 
          href="/notes" 
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-muted/60 border border-border/80 rounded-xl hover:bg-muted text-xs text-foreground font-semibold transition-all active:scale-[0.98]"
        >
          Open Notes Workspace
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
