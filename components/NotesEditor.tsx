"use client";

import React, { useEffect, useState } from "react";
import NotesRichEditor from "@/components/NotesRichEditor";
import { FileText, Plus, Trash2, Calendar, FolderOpen, Edit3 } from "lucide-react";
import toast from "react-hot-toast";

type Note = {
  id: string;
  title: string | null;
  content: string;
  attachments: string[]; // [0] is category, [1...] are attachments
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];

export default function NotesEditor() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Active Editor state
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const [activeCategory, setActiveCategory] = useState("Inbox");

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = () => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        setNotes(Array.isArray(data) ? data : []);
        // Set first note as default active note if available
        if (Array.isArray(data) && data.length > 0 && !selectedNote) {
          loadNoteInEditor(data[0]);
        }
      })
      .catch(() => setNotes([]));
  };

  const loadNoteInEditor = (note: Note) => {
    setSelectedNote(note);
    setActiveTitle(note.title || "");
    setActiveContent(note.content || "");
    
    // Parse category from attachments[0], fallback to "Inbox"
    const cat = note.attachments && note.attachments.length > 0 ? note.attachments[0] : "Inbox";
    setActiveCategory(cat);
  };

  const createNewNoteState = () => {
    setSelectedNote(null);
    setActiveTitle("");
    setActiveContent("<p><br></p>");
    setActiveCategory("Inbox");
  };

  const handleSave = async (title: string, content: string, category: string) => {
    setIsSaving(true);
    
    // Prepare attachments: [category, ...images]
    const currentAttachments = selectedNote?.attachments || [];
    const otherAttachments = currentAttachments.slice(1);
    const newAttachments = [category, ...otherAttachments];

    const notePayload = {
      id: selectedNote?.id,
      title,
      content,
      category,
      attachments: newAttachments,
    };

    try {
      const endpoint = "/api/notes";
      const method = selectedNote ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notePayload),
      });

      if (res.ok) {
        const savedNote = await res.json();
        toast.success(selectedNote ? "Note updated!" : "Note created!");
        
        // Re-fetch notes to sync list
        fetchNotes();
        
        // Load saved note
        loadNoteInEditor(savedNote);
      } else {
        toast.error("Failed to save note");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading note on delete click
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/api/notes?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Note deleted");
        fetchNotes();
        if (selectedNote?.id === id) {
          createNewNoteState();
        }
      } else {
        toast.error("Failed to delete note");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  // Helper to extract a clean text summary from HTML content for previews
  const getHtmlTextPreview = (html: string) => {
    if (!html) return "Empty note";
    // Strip tags
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.length > 120 ? text.slice(0, 120) + "..." : text || "Empty note";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-10">
      
      {/* LEFT COLUMN: Workspace Editor */}
      <div className="lg:col-span-6 space-y-4">
        <div className="flex justify-between items-center bg-slate-900/20 p-2 border border-border/40 rounded-xl">
          <span className="text-xs font-semibold text-muted-foreground px-2">
            {selectedNote ? "Editing Note" : "Drafting New Note"}
          </span>
          <button
            onClick={createNewNoteState}
            className="app-button-primary py-2 px-4 text-xs font-bold flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> New Note
          </button>
        </div>

        <NotesRichEditor
          initialTitle={activeTitle}
          initialContent={activeContent}
          initialCategory={activeCategory}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>

      {/* RIGHT COLUMN: masonry staggered notes grid */}
      <div className="lg:col-span-6 space-y-6">
        
        {notes.length === 0 ? (
          <div className="app-card py-16 text-center text-muted-foreground border border-border/40 bg-slate-900/10">
            <FileText className="mx-auto h-12 w-12 opacity-15 mb-3" />
            <p className="text-sm font-semibold">No notes recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start writing your thoughts on the left!</p>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const catNotes = notes.filter((n) => {
              const noteCat = n.attachments && n.attachments.length > 0 ? n.attachments[0] : "Inbox";
              return noteCat === cat;
            });
            if (catNotes.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {cat} ({catNotes.length})
                </h3>

                {/* Pure CSS Masonry Staggered Grid */}
                <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                  {catNotes.map((note) => {
                    const isActive = selectedNote?.id === note.id;
                    const textPreview = getHtmlTextPreview(note.content);

                    return (
                      <div
                        key={note.id}
                        onClick={() => loadNoteInEditor(note)}
                        className={`break-inside-avoid w-full app-card flex flex-col justify-between border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] p-5 mb-4 group ${
                          isActive
                            ? "border-primary/80 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/40 hover:border-border/80"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-3">
                            <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {note.title || "Untitled Note"}
                            </h4>
                            <button
                              onClick={(e) => deleteNote(note.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 transition-opacity"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 text-left line-clamp-4">
                            {textPreview}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/20 text-[9px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Updated {new Date(note.updatedAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
