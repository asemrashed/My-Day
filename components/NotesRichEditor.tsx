"use client";

import React, { useRef, useEffect, useState } from "react";
import { Bold, Italic, Heading1, Heading2, Heading3, Link as LinkIcon, Table, Image as ImageIcon, Highlighter, Palette, FileText, Check } from "lucide-react";
import toast from "react-hot-toast";

interface NotesRichEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: string;
  onSave: (title: string, content: string, category: string) => Promise<void> | void;
  isSaving?: boolean;
}

const CATEGORIES = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];

export default function NotesRichEditor({
  initialTitle = "",
  initialContent = "",
  initialCategory = "Inbox",
  onSave,
  isSaving = false,
}: NotesRichEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync state if initial values change (e.g. when user clicks on a note on the right)
  useEffect(() => {
    setTitle(initialTitle);
    setCategory(initialCategory);
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || "<p><br></p>";
    }
  }, [initialTitle, initialContent, initialCategory]);

  // Execute native rich text format commands
  const execCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Insert hyper link helper
  const insertLink = () => {
    const url = prompt("Enter the URL:");
    if (!url) return;
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    execCommand("createLink", formattedUrl);
  };

  // Insert dynamic HTML table helper
  const insertTable = () => {
    const rows = prompt("Enter number of rows:", "3");
    const cols = prompt("Enter number of columns:", "3");
    if (!rows || !cols) return;

    const r = parseInt(rows);
    const c = parseInt(cols);
    if (isNaN(r) || isNaN(c) || r <= 0 || c <= 0) return;

    let tableHtml = `<table class="min-w-full border-collapse border border-slate-700 my-4 text-xs font-sans rounded-lg overflow-hidden"><thead><tr class="bg-slate-800">`;
    for (let j = 0; j < c; j++) {
      tableHtml += `<th class="border border-slate-700 px-3 py-2 text-left font-bold text-foreground">Header ${j + 1}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let i = 0; i < r; i++) {
      tableHtml += `<tr>`;
      for (let j = 0; j < c; j++) {
        tableHtml += `<td class="border border-slate-700 px-3 py-2 text-muted-foreground bg-slate-900/20">Data</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;

    // Insert at cursor
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertHTML", false, tableHtml);
    }
  };

  // Insert image file helper
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && editorRef.current) {
        editorRef.current.focus();
        const imgHtml = `<img src="${reader.result}" alt="${file.name}" class="max-w-full h-auto rounded-xl my-4 border border-border/80 shadow-md inline-block pointer-events-auto" /><p><br></p>`;
        document.execCommand("insertHTML", false, imgHtml);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClick = () => {
    const htmlContent = editorRef.current?.innerHTML || "";
    if (!title.trim()) {
      toast.error("Please enter a note title");
      return;
    }
    onSave(title.trim(), htmlContent, category);
  };

  return (
    <div className="space-y-4 border border-border/60 bg-slate-900/40 p-5 rounded-2xl">
      {/* Title & Category Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[9px] uppercase font-extrabold text-muted-foreground tracking-wider block mb-1">Note Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Planning Checklist"
            className="app-input text-xs py-2.5 font-bold"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-extrabold text-muted-foreground tracking-wider block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="app-input text-xs py-2.5 font-bold"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Formatting WYSIWYG Toolbar */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/80 border border-border/60 rounded-xl">
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<h1>")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="H1 Heading"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<h2>")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="H2 Heading"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<h3>")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="H3 Heading"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<p>")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80 font-bold text-xs"
          title="Paragraph"
        >
          P
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        <button
          type="button"
          onClick={() => execCommand("bold")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("italic")}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        {/* Text color picker dropdown */}
        <label className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80 relative cursor-pointer" title="Text Color">
          <Palette className="h-4 w-4" />
          <input
            type="color"
            onChange={(e) => execCommand("foreColor", e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        {/* Text highlight color picker */}
        <label className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80 relative cursor-pointer" title="Highlight Text">
          <Highlighter className="h-4 w-4" />
          <input
            type="color"
            defaultValue="#FFFF00"
            onChange={(e) => execCommand("hiliteColor", e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        <div className="w-px h-6 bg-slate-800 self-center mx-1" />

        <button
          type="button"
          onClick={insertLink}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="Insert Hyperlink"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={insertTable}
          className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80"
          title="Insert Table"
        >
          <Table className="h-4 w-4" />
        </button>
        
        {/* Inline Image Upload */}
        <label className="p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80 relative cursor-pointer" title="Insert Image Inline">
          <ImageIcon className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageFile}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="w-full min-h-[300px] max-h-[500px] overflow-y-auto p-4 border border-border/60 rounded-xl bg-slate-950/20 font-sans text-xs text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 leading-relaxed text-left"
        style={{ outline: "none" }}
      />

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className="app-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-primary/25 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Note
            </>
          )}
        </button>
      </div>
    </div>
  );
}
