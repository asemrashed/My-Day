"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatFileSize, type FileAttachmentDto } from "@/lib/files-shared";

type OwnerType = "NOTE" | "PROJECT";

type FileAttachmentsProps = {
  ownerType: OwnerType;
  ownerId?: string | null;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  /** Compact layout for forms */
  compact?: boolean;
  className?: string;
};

const ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.rtf,.xls,.xlsx,.csv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.xml,.yml,.yaml,.py,.go,.java,.sql,.sh,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip,.rar,.7z";

function iconForName(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) return ImageIcon;
  if ([".xls", ".xlsx", ".csv"].includes(ext)) return FileSpreadsheet;
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".html", ".css", ".json", ".xml", ".yml", ".yaml", ".sql", ".sh"].includes(ext)) {
    return FileCode;
  }
  if ([".pdf", ".doc", ".docx", ".txt", ".md", ".rtf"].includes(ext)) return FileText;
  return File;
}

async function uploadOne(ownerType: OwnerType, ownerId: string, file: File) {
  const body = new FormData();
  body.append("ownerType", ownerType);
  body.append("ownerId", ownerId);
  body.append("file", file);
  const res = await fetch("/api/files", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as FileAttachmentDto;
}

/** Upload queued local files after a note/project is created. */
export async function uploadPendingFiles(
  ownerType: OwnerType,
  ownerId: string,
  files: File[]
) {
  const uploaded: FileAttachmentDto[] = [];
  for (const file of files) {
    uploaded.push(await uploadOne(ownerType, ownerId, file));
  }
  return uploaded;
}

export default function FileAttachments({
  ownerType,
  ownerId,
  pendingFiles = [],
  onPendingFilesChange,
  compact = false,
  className = "",
}: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileAttachmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!ownerId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`
      );
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerType]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (picked.length === 0) return;

    if (!ownerId) {
      if (!onPendingFilesChange) {
        toast.error("Save first, then attach files");
        return;
      }
      const next = [...pendingFiles];
      for (const file of picked) {
        if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
        next.push(file);
      }
      onPendingFilesChange(next);
      toast.success(picked.length === 1 ? "File queued" : `${picked.length} files queued`);
      return;
    }

    setUploading(true);
    let ok = 0;
    try {
      for (const file of picked) {
        try {
          const row = await uploadOne(ownerType, ownerId, file);
          setFiles((prev) => [row, ...prev]);
          ok += 1;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Failed: ${file.name}`);
        }
      }
      if (ok > 0) toast.success(ok === 1 ? "File uploaded" : `${ok} files uploaded`);
    } finally {
      setUploading(false);
    }
  };

  const removePending = (index: number) => {
    if (!onPendingFilesChange) return;
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
  };

  const removeSaved = async (id: string) => {
    if (!confirm("Remove this file?")) return;
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success("File removed");
    } catch {
      toast.error("Could not remove file");
    }
  };

  const hasAny = files.length > 0 || pendingFiles.length > 0;

  return (
    <div className={className}>
      <div className={`flex items-center justify-between gap-3 ${compact ? "mb-2" : "mb-3"}`}>
        <div className="min-w-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            Attachments
          </h3>
          {!compact && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Upload .tsx, .md, .html, PDF, Excel, images, and other project files.
              {!ownerId ? " Files upload after you save." : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="app-icon-button text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={handlePick}
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading files…
        </p>
      ) : !hasAny ? (
        <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 px-3 py-4 text-center">
          No files attached yet
        </p>
      ) : (
        <ul className="space-y-2">
          {pendingFiles.map((file, index) => {
            const Icon = iconForName(file.name);
            return (
              <li
                key={`pending-${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              >
                <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)} · pending save
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePending(index)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}

          {files.map((file) => {
            const Icon = iconForName(file.originalName);
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{file.originalName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <a
                  href={`/api/files/${file.id}`}
                  download={file.originalName}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => removeSaved(file.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
