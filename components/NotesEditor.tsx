"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NotesRichEditor from "@/components/NotesRichEditor";
import FormModal from "@/components/FormModal";
import FileAttachments, { uploadPendingFiles } from "@/components/FileAttachments";
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
import ReferencesPanel from "@/components/ReferencesPanel";
import { useInvalidateAppQueries } from "@/hooks/useAppQueries";

type NoteSummary = {
  id: string;
  title: string | null;
  preview: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
};

type Note = NoteSummary & {
  content?: string;
};

type NoteDraft = {
  title: string;
  content: string;
  category: string;
};

const CATEGORIES = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];
const PAGE_SIZE = 10;

export default function NotesEditor() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
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
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { invalidateNotes } = useInvalidateAppQueries();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const activeGroupRef = useRef<string | null>(null);
  const groupsRef = useRef<string[]>([]);
  const nextCursorRef = useRef<string | null>(null);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
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

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchDebounced) params.set("q", searchDebounced);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  }, [searchDebounced, dateFrom, dateTo]);

  const fetchGroupPage = useCallback(
    async (group: string, cursor?: string | null) => {
      const params = filterParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("category", group);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/notes?${params}`);
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ notes: NoteSummary[]; nextCursor: string | null }>;
    },
    [filterParams]
  );

  const hasMoreToLoad = useCallback(() => {
    if (nextCursorRef.current) return true;
    const group = activeGroupRef.current;
    if (!group) return false;
    const idx = groupsRef.current.indexOf(group);
    return idx >= 0 && idx < groupsRef.current.length - 1;
  }, []);

  const resetAndLoad = useCallback(async () => {
    setLoading(true);
    setSelectedNote(null);
    setNotes([]);
    setNextCursor(null);
    nextCursorRef.current = null;
    try {
      if (filterCategory !== "all") {
        setGroups([filterCategory]);
        groupsRef.current = [filterCategory];
        setActiveGroup(filterCategory);
        activeGroupRef.current = filterCategory;
        const data = await fetchGroupPage(filterCategory, null);
        setNotes(data.notes || []);
        setNextCursor(data.nextCursor || null);
        nextCursorRef.current = data.nextCursor || null;
        return;
      }

      const metaParams = filterParams();
      metaParams.set("meta", "groups");
      const metaRes = await fetch(`/api/notes?${metaParams}`);
      if (!metaRes.ok) throw new Error();
      const meta = await metaRes.json();
      const groupNames: string[] = Array.isArray(meta.groups) ? meta.groups.map((g: { name: string }) => g.name) : [];
      setGroups(groupNames);
      groupsRef.current = groupNames;
      if (groupNames.length === 0) {
        setActiveGroup(null);
        activeGroupRef.current = null;
        setNotes([]);
        return;
      }
      const first = groupNames[0];
      setActiveGroup(first);
      activeGroupRef.current = first;
      const data = await fetchGroupPage(first, null);
      setNotes(data.notes || []);
      setNextCursor(data.nextCursor || null);
      nextCursorRef.current = data.nextCursor || null;
    } catch {
      setNotes([]);
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterParams, fetchGroupPage]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading) return;
    if (!hasMoreToLoad()) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const cursor = nextCursorRef.current;
      let group = activeGroupRef.current;
      if (!group) return;

      if (cursor) {
        const data = await fetchGroupPage(group, cursor);
        setNotes((current) => [...current, ...(data.notes || [])]);
        setNextCursor(data.nextCursor || null);
        nextCursorRef.current = data.nextCursor || null;
        return;
      }

      const idx = groupsRef.current.indexOf(group);
      const nextGroup = groupsRef.current[idx + 1];
      if (!nextGroup) return;
      setActiveGroup(nextGroup);
      activeGroupRef.current = nextGroup;
      const data = await fetchGroupPage(nextGroup, null);
      setNotes((current) => [...current, ...(data.notes || [])]);
      setNextCursor(data.nextCursor || null);
      nextCursorRef.current = data.nextCursor || null;
    } catch {
      toast.error("Failed to load more notes");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchGroupPage, hasMoreToLoad, loading]);

  useEffect(() => {
    resetAndLoad();
  }, [resetAndLoad]);

  const overviewOpen = !!selectedNote;
  const canLoadMore = !!nextCursor || (!!activeGroup && groups.indexOf(activeGroup) < groups.length - 1);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canLoadMore) return;
    const root = listScrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root: overviewOpen ? null : root, rootMargin: "240px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore, notes.length, overviewOpen]);

  const getNoteCategory = (note: NoteSummary) =>
    note.attachments && note.attachments.length > 0 ? note.attachments[0] : "Inbox";

  const currentDraftKey = () => draftKey("note", editingNote?.id);

  const notesByGroup = useMemo(() => {
    const map = new Map<string, NoteSummary[]>();
    for (const note of notes) {
      const cat = getNoteCategory(note);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(note);
    }
    const order = [...CATEGORIES, ...Array.from(map.keys()).filter((k) => !CATEGORIES.includes(k))];
    return order
      .filter((cat) => map.has(cat))
      .map((category) => ({ category, notes: map.get(category)! }));
  }, [notes]);

  const openCreate = () => {
    setEditingNote(null);
    setPendingFiles([]);
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

  const loadFullNote = async (id: string) => {
    const response = await fetch(`/api/notes/${id}`);
    if (!response.ok) throw new Error();
    return (await response.json()) as Note;
  };

  const selectNote = async (note: NoteSummary) => {
    setSelectedNote({ ...note, content: undefined });
    setLoadingSelected(true);
    try {
      const full = await loadFullNote(note.id);
      setSelectedNote(full);
    } catch {
      toast.error("Failed to open note");
      setSelectedNote(null);
    } finally {
      setLoadingSelected(false);
    }
  };

  const openEdit = async (note: NoteSummary | Note) => {
    setPendingFiles([]);
    let full: Note = note as Note;
    if (!full.content) {
      try {
        full = await loadFullNote(note.id);
      } catch {
        return toast.error("Failed to load note");
      }
    }
    setEditingNote(full);
    const key = draftKey("note", full.id);
    const existing = loadDraft<NoteDraft>(key);
    const base: NoteDraft = {
      title: full.title || "",
      content: full.content || "<p></p>",
      category: getNoteCategory(full),
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
    setPendingFiles([]);
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
        if (pendingFiles.length > 0) {
          try {
            await uploadPendingFiles("NOTE", savedNote.id, pendingFiles);
          } catch {
            toast.error("Note saved, but some files failed to upload");
          }
        }
        toast.success(editingNote ? "Note updated!" : "Note created!");
        clearDraft(draftKey("note", editingNote?.id));
        clearDraft(draftKey("note", savedNote.id));
        closeForm();
        await resetAndLoad();
        void invalidateNotes();
        setSelectedNote(savedNote);
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
        setNotes((current) => current.filter((note) => note.id !== id));
        void invalidateNotes();
      } else {
        toast.error("Failed to delete note");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const hasFilters = filterCategory !== "all" || !!search || !!dateFrom || !!dateTo;

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
            {notes.length} note{notes.length === 1 ? "" : "s"} loaded
            {canLoadMore ? "+" : ""}
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
      {loading ? (
        <div className="app-card py-16 text-center text-muted-foreground border border-border/40">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="app-card py-16 text-center text-muted-foreground border border-border/40">
          <FileText className="mx-auto h-10 w-10 opacity-15 mb-3" />
          <p className="text-sm font-semibold">{hasFilters ? "No notes match your filters" : "No notes yet"}</p>
          <p className="text-xs mt-1">{hasFilters ? "Try adjusting search or filters" : "Create a note to get started"}</p>
        </div>
      ) : (
        <div className="space-y-8 pb-2">
          {notesByGroup.map(({ category, notes: groupNotes }) => (
            <section key={category} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary">{category}</h3>
                <span className="text-[10px] text-muted-foreground tabular-nums">{groupNotes.length}</span>
              </div>
              <div
                className={`grid gap-4 ${
                  overviewOpen ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {groupNotes.map((note) => {
                  const isActive = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => selectNote(note)}
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
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 line-clamp-3">{note.preview}</p>
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
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && <p className="text-center text-xs text-muted-foreground py-2">Loading more…</p>}
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

          <div className="note-preview text-foreground flex-1 min-h-0 overflow-y-auto slim-scrollbar">
            {loadingSelected || !selectedNote.content ? (
              <p className="text-sm text-muted-foreground">Loading note…</p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: selectedNote.content || "<p>Empty note</p>" }} />
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/40 shrink-0">
            <FileAttachments ownerType="NOTE" ownerId={selectedNote.id} />
          </div>

          <div className="mt-4 pt-4 border-t border-border/40 shrink-0">
            <ReferencesPanel sourceType="NOTE" sourceId={selectedNote.id} />
          </div>
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
          ref={listScrollRef}
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
            <p className="text-xs text-amber-700 dark:text-amber-200 font-medium">Unsaved draft found from earlier.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-500/30"
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

        <div className="mt-4 pt-4 border-t border-border/40">
          <FileAttachments
            ownerType="NOTE"
            ownerId={editingNote?.id}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            compact
          />
        </div>
      </FormModal>
    </div>
  );
}
