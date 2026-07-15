"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Highlighter,
  List,
  ListOrdered,
  ListTodo,
  Undo,
  Redo,
  Check,
  Type,
  Palette,
  Calculator,
  HelpCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  analyzeNoteCalculations,
  formatCalcNumber,
  buildCalcSummary,
  applyCalculatedValuesToHtml,
} from "@/lib/noteCalc";

interface NotesRichEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: string;
  onSave: (title: string, content: string, category: string) => Promise<void> | void;
  onChangeDraft?: (draft: { title: string; content: string; category: string }) => void;
  isSaving?: boolean;
  calculationMode?: boolean;
  taskMode?: boolean;
}

const CATEGORIES = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];
const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Primary", value: "#22d3ee" },
  { label: "Green", value: "#34d399" },
  { label: "Amber", value: "#fbbf24" },
  { label: "Rose", value: "#fb7185" },
  { label: "Violet", value: "#a78bfa" },
  { label: "White", value: "#f8fafc" },
  { label: "Muted", value: "#94a3b8" },
];

/** Split hard-break-heavy blocks into real paragraphs so heading toggles only affect one line. */
function splitHardBreaksAroundCursor(editor: Editor) {
  const { state } = editor;
  const { $from } = state.selection;
  const parent = $from.parent;
  if (!parent.isTextblock) return;

  let hasHardBreak = false;
  parent.forEach((child) => {
    if (child.type.name === "hardBreak") hasHardBreak = true;
  });
  if (!hasHardBreak) return;

  const parts: ReturnType<typeof parent.content.cut>[] = [];
  let start = 0;
  parent.forEach((child, offset) => {
    if (child.type.name === "hardBreak") {
      parts.push(parent.content.cut(start, offset));
      start = offset + child.nodeSize;
    }
  });
  parts.push(parent.content.cut(start));

  const paragraph = state.schema.nodes.paragraph;
  const heading = state.schema.nodes.heading;
  const nodeType = parent.type === heading ? paragraph : parent.type === paragraph ? paragraph : paragraph;

  const nodes = parts.map((content) => {
    if (content.size === 0) return nodeType.createAndFill() || nodeType.create();
    return nodeType.create(null, content);
  });

  const from = $from.before();
  const to = $from.after();
  const fragment = Fragment.from(nodes);
  let tr = state.tr.replaceWith(from, to, fragment);

  // Keep cursor in the first resulting block at a sensible offset
  const cursorPos = from + 1;
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(cursorPos, tr.doc.content.size - 1))));
  editor.view.dispatch(tr);
}

function applyBlockHeading(editor: Editor, level: 1 | 2 | 3) {
  splitHardBreaksAroundCursor(editor);
  const { $from } = editor.state.selection;
  const start = $from.start();
  const end = $from.end();
  // Limit to current textblock only (avoids converting the whole multi-block selection unexpectedly)
  editor
    .chain()
    .focus()
    .setTextSelection({ from: start, to: start })
    .toggleHeading({ level })
    .run();
  void end;
}

function applyParagraph(editor: Editor) {
  splitHardBreaksAroundCursor(editor);
  const { $from } = editor.state.selection;
  editor.chain().focus().setTextSelection({ from: $from.start(), to: $from.start() }).setParagraph().run();
}

export default function NotesRichEditor({
  initialTitle = "",
  initialContent = "",
  initialCategory = "Inbox",
  onSave,
  onChangeDraft,
  isSaving = false,
  calculationMode = false,
  taskMode = false,
}: NotesRichEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [showCalcHelp, setShowCalcHelp] = useState(false);
  const [editorHtml, setEditorHtml] = useState(initialContent || "<p></p>");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "max-w-full h-auto rounded-xl my-4 border border-border/80" },
      }),
      TaskList.configure({
        HTMLAttributes: { class: "note-task-list" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "note-task-item" },
      }),
      Placeholder.configure({ placeholder: "Start writing… Press Enter for a new line." }),
    ],
    content: initialContent || "<p></p>",
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none text-foreground",
      },
      handleKeyDown: (_view, event) => {
        // Enter splits into a new paragraph (default). Soft breaks stay on Shift+Enter.
        if (event.key === "Enter" && !event.shiftKey) {
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      setEditorHtml(ed.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    setTitle(initialTitle);
    setCategory(initialCategory);
    if (editor && !editor.isDestroyed) {
      const next = initialContent || "<p></p>";
      if (editor.getHTML() !== next) {
        editor.commands.setContent(next, { emitUpdate: false });
        setEditorHtml(next);
      }
    }
  }, [initialTitle, initialContent, initialCategory, editor]);

  useEffect(() => {
    if (!onChangeDraft) return;
    const t = setTimeout(() => {
      onChangeDraft({
        title,
        content: editor?.getHTML() || editorHtml,
        category,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [title, category, editorHtml, editor, onChangeDraft]);

  const calc = useMemo(
    () => (calculationMode ? analyzeNoteCalculations(editorHtml) : null),
    [calculationMode, editorHtml]
  );

  const toolbarBtn = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${
      active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
    }`;

  const insertLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Enter the URL:", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    let formatted = url.trim();
    if (!/^https?:\/\//i.test(formatted)) formatted = `https://${formatted}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: formatted }).run();
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyTextColor = (color: string) => {
    if (!editor) return;
    if (!color) {
      editor.chain().focus().unsetColor().run();
      return;
    }
    editor.chain().focus().setColor(color).run();
  };

  const insertCalcSummary = () => {
    if (!editor || !calc) return;
    const summary = buildCalcSummary(calc);
    editor.chain().focus().insertContent(`<pre><code>${summary}</code></pre><p></p>`).run();
    toast.success("Calculation summary inserted");
  };

  const fillUnknownsInEditor = () => {
    if (!editor || !calc) return;
    const hasFillable = calc.entries.some(
      (e) => e.value !== null && (e.expression || e.raw.includes("?") || /=\s*$/.test(e.raw))
    );
    if (!hasFillable && calc.totals.firstMinusRest === null) {
      insertCalcSummary();
      return;
    }
    const nextHtml = applyCalculatedValuesToHtml(editor.getHTML(), calc);
    editor.commands.setContent(nextHtml);
    toast.success("Filled calculated values");
  };

  const handleSaveClick = () => {
    if (!editor) return;
    if (!title.trim()) {
      toast.error("Please enter a note title");
      return;
    }
    onSave(title.trim(), editor.getHTML(), category);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[9px] uppercase font-extrabold text-muted-foreground tracking-wider block mb-1">
            Note Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Planning Checklist"
            className="app-input text-xs py-2.5 font-bold"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-extrabold text-muted-foreground tracking-wider block mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="app-input text-xs py-2.5 font-bold"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(calculationMode || taskMode) && (
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {calculationMode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Calculator className="h-3 w-3" /> Calculation Mode
            </span>
          )}
          {taskMode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/30">
              <ListTodo className="h-3 w-3" /> Task Mode
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 p-2 bg-muted/60 border border-border/60 rounded-xl">
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("paragraph") ?? false)}
          onClick={() => editor && applyParagraph(editor)}
          title="Paragraph"
        >
          <Type className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("heading", { level: 1 }) ?? false)}
          onClick={() => editor && applyBlockHeading(editor, 1)}
          title="Heading 1 (current line only)"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("heading", { level: 2 }) ?? false)}
          onClick={() => editor && applyBlockHeading(editor, 2)}
          title="Heading 2 (current line only)"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("heading", { level: 3 }) ?? false)}
          onClick={() => editor && applyBlockHeading(editor, 3)}
          title="Heading 3 (current line only)"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border self-center mx-1" />

        <button
          type="button"
          className={toolbarBtn(editor?.isActive("bold") ?? false)}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("italic") ?? false)}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("underline") ?? false)}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("highlight") ?? false)}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <div className="relative group">
          <button
            type="button"
            className={toolbarBtn(Boolean(editor?.getAttributes("textStyle").color))}
            title="Text color"
          >
            <Palette className="h-4 w-4" />
          </button>
          <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:flex group-focus-within:flex flex-col gap-1 p-2 rounded-xl border border-border bg-card shadow-xl min-w-[120px]">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => applyTextColor(c.value)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-muted text-left"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                  style={{ background: c.value || "currentColor" }}
                />
                {c.label}
              </button>
            ))}
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-muted cursor-pointer">
              <input
                type="color"
                className="h-4 w-4 cursor-pointer"
                onChange={(e) => applyTextColor(e.target.value)}
                title="Custom color"
              />
              Custom
            </label>
          </div>
        </div>

        <div className="w-px h-6 bg-border self-center mx-1" />

        <button
          type="button"
          className={toolbarBtn(editor?.isActive("bulletList") ?? false)}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={toolbarBtn(editor?.isActive("orderedList") ?? false)}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        {taskMode && (
          <button
            type="button"
            className={toolbarBtn(editor?.isActive("taskList") ?? false)}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            title="Task checklist"
          >
            <ListTodo className="h-4 w-4" />
          </button>
        )}

        <div className="w-px h-6 bg-border self-center mx-1" />

        <button
          type="button"
          className={toolbarBtn(editor?.isActive("link") ?? false)}
          onClick={insertLink}
          title="Insert link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <label className={`${toolbarBtn(false)} relative cursor-pointer`} title="Insert image">
          <ImageIcon className="h-4 w-4" />
          <input type="file" accept="image/*" onChange={handleImageFile} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>

        <div className="w-px h-6 bg-border self-center mx-1" />

        <button type="button" className={toolbarBtn(false)} onClick={() => editor?.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" />
        </button>
        <button type="button" className={toolbarBtn(false)} onClick={() => editor?.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" />
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Tip: press <kbd className="px-1 rounded bg-muted border border-border">Enter</kbd> for a new
        paragraph/line. Headings apply to the current line only.
      </p>

      <div className="border border-border/60 rounded-xl bg-background/40 overflow-hidden">
        <EditorContent editor={editor} />
      </div>

      {calculationMode && calc && (
        <div className="app-panel p-4 space-y-3 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" /> Live calculations
            </h4>
            <button
              type="button"
              onClick={() => setShowCalcHelp((v) => !v)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Syntax help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>

          {showCalcHelp && (
            <div className="text-[11px] text-muted-foreground space-y-1.5 bg-muted/40 p-3 rounded-xl">
              <p>
                <code className="text-foreground">@Total-Budget = 65000</code> — variable (hyphens OK)
              </p>
              <p>
                <code className="text-foreground">Advance @A = 10000</code> — label + short alias
              </p>
              <p>
                <code className="text-foreground">@Left = @Total-Budget - @A - 500</code> — + − × ÷ and ( )
              </p>
              <p>
                <code className="text-foreground">@Will-give = @T * 0.5</code> — use aliases in formulas
              </p>
              <p>
                <code className="text-foreground">Left = ?</code> — remaining = first value − rest
              </p>
            </div>
          )}

          {calc.errors.length > 0 && (
            <p className="text-[10px] text-destructive">{calc.errors.slice(0, 2).join(" · ")}</p>
          )}

          {calc.entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Write <span className="text-foreground font-medium">@Budget = 65000</span> then{" "}
              <span className="text-foreground font-medium">@Left = @Budget - 1000</span>
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {calc.entries.map((e) => (
                <div
                  key={`${e.lineIndex}-${e.key}`}
                  className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded-lg bg-background/50"
                >
                  <span className="truncate text-muted-foreground">{e.label}</span>
                  <span className="font-bold text-foreground tabular-nums shrink-0">
                    {e.value !== null ? formatCalcNumber(e.value) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs pt-1 border-t border-border/40">
            <span>
              Sum: <strong>{formatCalcNumber(calc.totals.sum)}</strong>
            </span>
            {calc.totals.firstMinusRest !== null && (
              <span className="text-amber-400">
                Remaining: <strong>{formatCalcNumber(calc.totals.firstMinusRest)}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fillUnknownsInEditor}
              className="app-button-primary py-1.5 px-3 text-[11px]"
            >
              Fill ? values
            </button>
            <button
              type="button"
              onClick={insertCalcSummary}
              className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"
            >
              Insert summary
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className="app-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
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
