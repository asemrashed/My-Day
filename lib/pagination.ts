import type { Prisma } from "@prisma/client";

/** Strip HTML and return a short plain-text preview (~2–3 lines). */
export function notePreview(html: string, maxChars = 180): string {
  const text = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Empty note";
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}

export function encodeCursor(date: Date, id: string) {
  return Buffer.from(`${date.toISOString()}|${id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { date: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.lastIndexOf("|");
    if (sep < 0) return null;
    const date = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (!id || Number.isNaN(date.getTime())) return null;
    return { date, id };
  } catch {
    return null;
  }
}

export function clampLimit(value: string | null, fallback: number, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export const NOTE_CATEGORY_ORDER = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"] as const;

export function noteCategoryOf(attachments: string[] | null | undefined) {
  return attachments && attachments.length > 0 ? attachments[0] : "Inbox";
}

/** Prisma filter for a notes category (category is stored as attachments[0]). */
export function categoryWhere(category: string): Prisma.NoteWhereInput {
  if (category === "Inbox") {
    return {
      OR: [{ attachments: { equals: [] } }, { attachments: { has: "Inbox" } }],
    };
  }
  return { attachments: { has: category } };
}
