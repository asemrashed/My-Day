"use client";
import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  initialValue?: string;
  onSave?: (markdown: string, title?: string, attachments?: string[]) => Promise<void> | void;
}

export default function MarkdownEditor({ initialValue = "", onSave }: Props) {
  const [markdown, setMarkdown] = useState(initialValue);
  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertAtCursor(before: string, after = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const newText = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + before.length + (end - start) + after.length;
      el.focus();
    });
  }

  function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      // insert markdown image with data URL
      insertAtCursor(`![${file.name}](${data})`);
      setAttachments((a) => [...a, data]);
    };
    reader.readAsDataURL(file);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      // insert link to attachment
      insertAtCursor(`[${file.name}](${data})`);
      setAttachments((a) => [...a, data]);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full input mb-3"
      />

      <div className="mb-2 flex gap-2">
        <button type="button" onClick={() => insertAtCursor("**", "**")} className="btn">Bold</button>
        <button type="button" onClick={() => insertAtCursor("*", "*")} className="btn">Italic</button>
        <button type="button" onClick={() => insertAtCursor("## ")} className="btn">H2</button>
        <button type="button" onClick={() => insertAtCursor("- ")} className="btn">List</button>
        <label className="btn">
          Image
          <input type="file" accept="image/*" onChange={(e) => e.target.files && handleImage(e.target.files[0])} className="hidden" />
        </label>
        <label className="btn">
          Attach
          <input type="file" onChange={(e) => e.target.files && handleFile(e.target.files[0])} className="hidden" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="w-full h-56 p-3 border border-border rounded font-mono text-sm"
        />

        <div className="p-3 border border-border rounded overflow-auto bg-white/5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || "_Nothing to preview_"}</ReactMarkdown>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          className="btn btn-primary"
          onClick={() => onSave && onSave(markdown, title, attachments)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
