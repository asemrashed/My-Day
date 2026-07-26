import type { FileAttachmentDto } from "@/lib/files-shared";

export {
  ALLOWED_EXTENSIONS,
  OWNER_TYPES,
  MAX_FILE_SIZE,
  getExtension,
  isAllowedFilename,
  formatFileSize,
  type FileAttachmentDto,
  type FileOwnerType,
} from "@/lib/files-shared";

export function sanitizeFilename(filename: string) {
  const base = filename.replace(/^.*[\\/]/, "").replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return base.slice(0, 180) || "file";
}

export function toFileDto(row: {
  id: string;
  ownerType: string;
  ownerId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}): FileAttachmentDto {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}
