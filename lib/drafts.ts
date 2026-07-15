const PREFIX = "thryve-draft";

export function draftKey(kind: "note" | "goal", id?: string | null) {
  return `${PREFIX}:${kind}:${id || "new"}`;
}

export function saveDraft<T>(key: string, data: T) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function loadDraft<T>(key: string): { savedAt: number; data: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed as { savedAt: number; data: T };
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function hasDraft(key: string) {
  return loadDraft(key) !== null;
}
