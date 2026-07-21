import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export function createSessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function parseDeviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.toLowerCase();
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

function deviceModel() {
  return (prisma as any).deviceSession as typeof prisma.deviceSession | undefined;
}

export async function registerDeviceSession(userId: string, sessionId: string) {
  const model = deviceModel();
  if (!model) return;

  let userAgent: string | null = null;
  let ipAddress: string | null = null;
  try {
    const h = headers();
    userAgent = h.get("user-agent");
    const forwarded = h.get("x-forwarded-for");
    ipAddress = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    // headers() unavailable in some auth callback contexts
  }

  await model.create({
    data: {
      userId,
      sessionId,
      userAgent,
      ipAddress,
      label: parseDeviceLabel(userAgent),
    },
  });
}

export async function ensureDeviceSession(userId: string, sessionId: string) {
  const model = deviceModel();
  if (!model || !sessionId) return;

  const existing = await model.findUnique({ where: { sessionId } });
  if (existing) {
    if (existing.revokedAt) return;
    await model.update({
      where: { sessionId },
      data: { lastSeenAt: new Date() },
    });
    return;
  }

  await registerDeviceSession(userId, sessionId);
}

export async function touchDeviceSession(sessionId: string) {
  const model = deviceModel();
  if (!model) return;
  await model.updateMany({
    where: { sessionId, revokedAt: null },
    data: { lastSeenAt: new Date() },
  });
}

export async function isDeviceSessionValid(sessionId: string) {
  try {
    const model = deviceModel();
    if (!model) return true;
    const session = await model.findUnique({
      where: { sessionId },
    });
    // Allow legacy/missing rows so a failed registration never locks the user out.
    if (!session) return true;
    return !session.revokedAt;
  } catch {
    return true;
  }
}

export async function revokeDeviceSession(userId: string, sessionId: string) {
  const model = deviceModel();
  if (!model) return;
  await model.updateMany({
    where: { userId, sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllOtherDeviceSessions(userId: string, keepSessionId?: string) {
  const model = deviceModel();
  if (!model) return;
  await model.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSessionId ? { sessionId: { not: keepSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function listDeviceSessions(userId: string) {
  const model = deviceModel();
  if (!model) return [];
  return model.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });
}
