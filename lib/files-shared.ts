export const OWNER_TYPES = ["NOTE", "PROJECT"] as const;
export type FileOwnerType = (typeof OWNER_TYPES)[number];

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

/** Extensions users commonly attach to notes/projects */
export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".rtf",
  ".xls",
  ".xlsx",
  ".csv",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".xml",
  ".yml",
  ".yaml",
  ".py",
  ".go",
  ".java",
  ".sql",
  ".sh",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".zip",
  ".rar",
  ".7z",
]);

export type FileAttachmentDto = {
  id: string;
  ownerType: string;
  ownerId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export function getExtension(filename: string) {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

export function isAllowedFilename(filename: string) {
  const ext = getExtension(filename);
  return Boolean(ext) && ALLOWED_EXTENSIONS.has(ext);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
