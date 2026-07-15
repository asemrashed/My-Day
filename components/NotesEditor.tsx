"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import NotesRichEditor from "@/components/NotesRichEditor";
import FormModal from "@/components/FormModal";
import {
  FileText,
  Plus,
  Trash2,
  Calendar,
  Pencil,
  Calculator,
  ListTodo,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/drafts";
import DateInput from "@/components/DateInput";

type Note = {
  id: string;
  title: string | null;
  content: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
};

type NoteDraft = {
  title: string;
  content: string;
  category: string;
};

const CATEGORIES = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];

export default function NotesEditor() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [calculationMode, setCalculationMode] = useState(false);
  const [taskMode, setTaskMode] = useState(false);
  const [draftBanner, setDraftBanner] = useState<NoteDraft | null>(null);
  const [editorMountId, setEditorMountId] = useState(0);
  const [editorSeed, setEditorSeed] = useState<NoteDraft>({
    title: "",
    content: "<p></p>",
    category: "Inbox",
  });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchNotes();
    const calc = localStorage.getItem("thryve-notes-calc-mode");
    const task = localStorage.getItem("thryve-notes-task-mode");
    if (calc === "1") setCalculationMode(true);
    if (task === "1") setTaskMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("thryve-notes-calc-mode", calculationMode ? "1" : "0");
  }, [calculationMode]);

  useEffect(() => {
    localStorage.setItem("thryve-notes-task-mode", taskMode ? "1" : "0");
  }, [taskMode]);

  const fetchNotes = (preferId?: string) => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setNotes(list);
        if (preferId) {
          const found = list.find((n: Note) => n.id === preferId);
          if (found) setSelectedNote(found);
          return;
        }
        setSelectedNote((prev) => {
          if (!prev) return null;
          return list.find((n: Note) => n.id === prev.id) || null;
        });
      })
      .catch(() => setNotes([]));
  };

  const getNoteCategory = (note: Note) =>
    note.attachments && note.attachments.length > 0 ? note.attachments[0] : "Inbox";

  const currentDraftKey = () => draftKey("note", editingNote?.id);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const cat = getNoteCategory(note);
      const matchesCategory = filterCategory === "all" || cat === filterCategory;
      const q = search.trim().toLowerCase();
      const plain = note.content.replace(/<[^>]+>/g, " ").toLowerCase();
      const matchesSearch =
        !q ||
        (note.title || "").toLowerCase().includes(q) ||
        plain.includes(q) ||
        cat.toLowerCase().includes(q);

      const day = (note.updatedAt || note.createdAt).slice(0, 10);
      const matchesFrom = !dateFrom || day >= dateFrom;
      const matchesTo = !dateTo || day <= dateTo;

      return matchesCategory && matchesSearch && matchesFrom && matchesTo;
    });
  }, [notes, filterCategory, search, dateFrom, dateTo]);

  const notesByGroup = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of filteredNotes) {
      const cat = getNoteCategory(note);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(note);
    }
    const order = [...CATEGORIES, ...[...map.keys()].filter((k) => !CATEGORIES.includes(k))];
    return order
      .filter((cat) => map.has(cat))
      .map((category) => ({ category, notes: map.get(category)! }));
  }, [filteredNotes]);

  const openCreate = () => {
    setEditingNote(null);
    const key = draftKey("note", null);
    const existing = loadDraft<NoteDraft>(key);
    if (existing?.data && (existing.data.title || (existing.data.content && existing.data.content !== "<p></p>"))) {
      setDraftBanner(existing.data);
      setEditorSeed({ title: "", content: "<p></p>", category: "Inbox" });
    } else {
      setDraftBanner(null);
      setEditorSeed({ title: "", content: "<p></p>", category: "Inbox" });
    }
    setEditorMountId((n) => n + 1);
    setShowForm(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    const key = draftKey("note", note.id);
    const existing = loadDraft<NoteDraft>(key);
    const base: NoteDraft = {
      title: note.title || "",
      content: note.content || "<p></p>",
      category: getNoteCategory(note),
    };
    if (existing?.data && JSON.stringify(existing.data) !== JSON.stringify(base)) {
      setDraftBanner(existing.data);
      setEditorSeed(base);
    } else {
      setDraftBanner(null);
      setEditorSeed(base);
    }
    setEditorMountId((n) => n + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setDraftBanner(null);
  };

  const restoreDraft = () => {
    if (!draftBanner) return;
    setEditorSeed(draftBanner);
    setDraftBanner(null);
    setEditorMountId((n) => n + 1);
    toast.success("Draft restored");
  };

  const discardDraft = () => {
    clearDraft(currentDraftKey());
    setDraftBanner(null);
    toast.success("Draft discarded");
  };

  const handleDraftChange = useCallback(
    (draft: NoteDraft) => {
      const empty =
        !draft.title.trim() &&
        (!draft.content || draft.content === "<p></p>" || draft.content === "<p><br></p>");
      if (empty) {
        clearDraft(currentDraftKey());
        return;
      }
      saveDraft(currentDraftKey(), draft);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingNote?.id]
  );

  const handleSave = async (title: string, content: string, category: string) => {
    setIsSaving(true);
    const currentAttachments = editingNote?.attachments || [];
    const otherAttachments = currentAttachments.slice(1);
    const newAttachments = [category, ...otherAttachments];

    const notePayload = {
      id: editingNote?.id,
      title,
      content,
      category,
      attachments: newAttachments,
    };

    try {
      const method = editingNote ? "PUT" : "POST";
      const res = await fetch("/api/notes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notePayload),
      });

      if (res.ok) {
        const savedNote = await res.json();
        toast.success(editingNote ? "Note updated!" : "Note created!");
        clearDraft(draftKey("note", editingNote?.id));
        clearDraft(draftKey("note", savedNote.id));
        closeForm();
        fetchNotes(savedNote.id);
      } else {
        toast.error("Failed to save note");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Note deleted");
        clearDraft(draftKey("note", id));
        if (selectedNote?.id === id) setSelectedNote(null);
        fetchNotes();
      } else {
        toast.error("Failed to delete note");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const getHtmlTextPreview = (html: string) => {
    if (!html) return "Empty note";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.length > 100 ? text.slice(0, 100) + "…" : text || "Empty note";
  };

  const hasFilters = filterCategory !== "all" || !!search || !!dateFrom || !!dateTo;
  const overviewOpen = !!selectedNote;

  const toolbar = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCalculationMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              calculationMode
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Calculation Mode
          </button>
          <button
            type="button"
            onClick={() => setTaskMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              taskMode
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            Task Mode
          </button>
        </div>
        <button
          onClick={openCreate}
          className="app-button-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> New Note
        </button>
      </div>

      <div
        className={
          overviewOpen
            ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        }
      >
        <div className={overviewOpen ? "relative sm:col-span-2" : "relative"}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-input pl-9 pr-4 py-2 text-xs w-full"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="app-input py-2 text-xs"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <DateInput
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="py-2 text-xs"
          title="From date"
        />
        <DateInput
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="py-2 text-xs"
          title="To date"
        />
      </div>

      {hasFilters && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {filteredNotes.length} note{filteredNotes.length === 1 ? "" : "s"} found
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterCategory("all");
              setDateFrom("");
              setDateTo("");
            }}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  const notesList = (
    <>
      {filteredNotes.length === 0 ? (
        <div className="app-card py-16 text-center text-muted-foreground border border-border/40">
          <FileText className="mx-auto h-10 w-10 opacity-15 mb-3" />
          <p className="text-sm font-semibold">
            {notes.length === 0 ? "No notes yet" : "No notes match your filters"}
          </p>
          <p className="text-xs mt-1">
            {notes.length === 0 ? "Create a note to get started" : "Try adjusting search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-8 pb-2">
          {notesByGroup.map(({ category, notes: groupNotes }) => (
            <section key={category} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary">
                  {category}
                </h3>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {groupNotes.length}
                </span>
              </div>
              <div
                className={`grid gap-4 ${
                  overviewOpen
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {groupNotes.map((note) => {
                  const isActive = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className={`app-card p-4 cursor-pointer transition-all group border h-full min-w-0 ${
                        isActive
                          ? "border-primary/80 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/40 hover:border-border/80"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {note.title || "Untitled Note"}
                          </h4>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(note);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                            title="Edit note"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => deleteNote(note.id, e)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 line-clamp-3">
                        {getHtmlTextPreview(note.content)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/20 text-[9px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(note.updatedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );

  const overviewPanel =
    overviewOpen && selectedNote ? (
      <div className="min-w-0 lg:sticky lg:top-3 lg:h-[90vh] lg:self-start flex flex-col">
        <div className="app-card border border-border/50 p-5 sm:p-6 flex-1 flex flex-col min-h-0 overflow-hidden h-full">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-border/40 shrink-0">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary mb-1 block">
                {getNoteCategory(selectedNote)}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground break-words">
                {selectedNote.title || "Untitled Note"}
              </h2>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Updated{" "}
                {new Date(selectedNote.updatedAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedNote(null)}
                className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted"
                title="Close overview"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => openEdit(selectedNote)}
                className="app-button-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>

          <div
            className="note-preview text-foreground flex-1 min-h-0 overflow-y-auto slim-scrollbar"
            dangerouslySetInnerHTML={{ __html: selectedNote.content || "<p>Empty note</p>" }}
          />
        </div>
      </div>
    ) : null;

  return (
    <div
      className={
        overviewOpen
          ? "pb-8"
          : "flex flex-col min-h-0 h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-10rem)]"
      }
    >
      {!overviewOpen && <div className="shrink-0 mb-4">{toolbar}</div>}

      <div
        className={
          overviewOpen
            ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
            : "flex-1 min-h-0 grid grid-cols-1 gap-6"
        }
      >
        <div
          className={
            overviewOpen
              ? "min-w-0 space-y-4"
              : "min-w-0 min-h-0 overflow-y-auto slim-scrollbar pr-1"
          }
        >
          {overviewOpen && toolbar}
          {notesList}
        </div>

        {overviewPanel}
      </div>

      <FormModal
        open={showForm}
        onClose={closeForm}
        title={editingNote ? "Edit Note" : "New Note"}
        maxWidth="2xl"
      >
        {draftBanner && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs text-amber-200 font-medium">Unsaved draft found from earlier.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold hover:bg-amber-500/30"
              >
                <RotateCcw className="h-3 w-3" /> Restore
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-bold text-muted-foreground hover:bg-muted"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <NotesRichEditor
          key={`${editingNote?.id || "new"}-${editorMountId}`}
          initialTitle={editorSeed.title}
          initialContent={editorSeed.content}
          initialCategory={editorSeed.category}
          onSave={handleSave}
          onChangeDraft={handleDraftChange}
          isSaving={isSaving}
          calculationMode={calculationMode}
          taskMode={taskMode}
        />
      </FormModal>
    </div>
  );
}
