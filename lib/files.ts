import fs from "fs/promises";
import path from "path";
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

export function uploadsRoot() {
  return path.join(process.cwd(), "uploads");
}

export function userUploadDir(userId: string) {
  return path.join(uploadsRoot(), userId);
}

export function storedFilePath(userId: string, storedName: string) {
  return path.join(userUploadDir(userId), storedName);
}

export function sanitizeFilename(filename: string) {
  const base = path.basename(filename).replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return base.slice(0, 180) || "file";
}

export async function ensureUserUploadDir(userId: string) {
  const dir = userUploadDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function removeStoredFile(userId: string, storedName: string) {
  try {
    await fs.unlink(storedFilePath(userId, storedName));
  } catch {
    // file may already be gone
  }
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
