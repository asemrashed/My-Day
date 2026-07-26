"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SOURCE_TYPE = "PROJECT";
const LINK_TARGETS = ["NOTE", "TASK", "EVENT"] as const;
type LinkTarget = (typeof LINK_TARGETS)[number];

export type ProjectPayload = {
  id?: string;
  title: string;
  group?: string;
  status?: string;
  problem?: string;
  solution?: string;
  features?: string[];
  techStack?: string[];
  repoUrl?: string;
  liveUrl?: string;
  notes?: string;
  progress?: number;
  startDate?: string;
  dueDate?: string;
  noteIds?: string[];
  taskIds?: string[];
  eventIds?: string[];
};

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function cleanList(items?: string[]) {
  return Array.from(
    new Set((items || []).map((item) => item.trim()).filter(Boolean))
  );
}

function dateOrNull(value?: string) {
  return value ? new Date(value) : null;
}

function normalizeProjectPayload(payload: ProjectPayload) {
  return {
    title: payload.title.trim(),
    group: (payload.group || "General").trim() || "General",
    status: payload.status || "PLANNED",
    problem: payload.problem?.trim() || null,
    solution: payload.solution?.trim() || null,
    features: cleanList(payload.features),
    techStack: cleanList(payload.techStack),
    repoUrl: payload.repoUrl?.trim() || null,
    liveUrl: payload.liveUrl?.trim() || null,
    notes: payload.notes?.trim() || null,
    progress: Math.min(100, Math.max(0, Number(payload.progress || 0))),
    startDate: dateOrNull(payload.startDate),
    dueDate: dateOrNull(payload.dueDate),
  };
}

async function assertOwnsProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) throw new Error("Project not found");
  return project;
}

async function filterOwnedIds(userId: string, targetType: LinkTarget, ids: string[]) {
  const uniqueIds = cleanList(ids);
  if (uniqueIds.length === 0) return [];

  if (targetType === "NOTE") {
    const rows = await prisma.note.findMany({
      where: { userId, id: { in: uniqueIds } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  if (targetType === "TASK") {
    const rows = await prisma.task.findMany({
      where: { userId, id: { in: uniqueIds } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  const rows = await prisma.event.findMany({
    where: { userId, id: { in: uniqueIds } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function syncProjectLinks(userId: string, projectId: string, payload: ProjectPayload) {
  const nextByType: Record<LinkTarget, string[]> = {
    NOTE: await filterOwnedIds(userId, "NOTE", payload.noteIds || []),
    TASK: await filterOwnedIds(userId, "TASK", payload.taskIds || []),
    EVENT: await filterOwnedIds(userId, "EVENT", payload.eventIds || []),
  };

  await prisma.link.deleteMany({
    where: {
      userId,
      sourceType: SOURCE_TYPE,
      sourceId: projectId,
      targetType: { in: [...LINK_TARGETS] },
    },
  });

  const links = LINK_TARGETS.flatMap((targetType) =>
    nextByType[targetType].map((targetId) => ({
      userId,
      sourceType: SOURCE_TYPE,
      sourceId: projectId,
      targetType,
      targetId,
    }))
  );

  if (links.length > 0) {
    await prisma.link.createMany({ data: links });
  }
}

function projectRevalidate() {
  revalidatePath("/projects");
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/schedule");
}

export async function createProject(payload: ProjectPayload) {
  try {
    const userId = await getUserId();
    if (!payload.title?.trim()) return { error: "Project title is required" };

    const project = await prisma.project.create({
      data: {
        userId,
        ...normalizeProjectPayload(payload),
      },
    });

    await syncProjectLinks(userId, project.id, payload);
    projectRevalidate();
    return { success: true, project };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create project" };
  }
}

export async function updateProject(projectId: string, payload: ProjectPayload) {
  try {
    const userId = await getUserId();
    if (!payload.title?.trim()) return { error: "Project title is required" };
    await assertOwnsProject(userId, projectId);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: normalizeProjectPayload(payload),
    });

    await syncProjectLinks(userId, project.id, payload);
    projectRevalidate();
    return { success: true, project };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update project" };
  }
}

export async function deleteProject(projectId: string) {
  try {
    const userId = await getUserId();
    await assertOwnsProject(userId, projectId);

    await prisma.$transaction([
      prisma.fileAttachment.deleteMany({
        where: { userId, ownerType: SOURCE_TYPE, ownerId: projectId },
      }),
      prisma.link.deleteMany({
        where: { userId, sourceType: SOURCE_TYPE, sourceId: projectId },
      }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    projectRevalidate();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete project" };
  }
}

function deriveKey(pin: string, salt: string) {
  const appSecret = process.env.NEXTAUTH_SECRET || "thryveup-local-secret";
  return crypto.scryptSync(`${pin}:${appSecret}`, Buffer.from(salt, "base64"), 32);
}

export async function saveProjectSecret(projectId: string, pin: string, secretText: string) {
  try {
    const userId = await getUserId();
    if (!pin || pin.length < 4) return { error: "PIN must be at least 4 characters" };
    await assertOwnsProject(userId, projectId);

    const salt = crypto.randomBytes(16).toString("base64");
    const iv = crypto.randomBytes(12);
    const key = deriveKey(pin, salt);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secretText || "", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const pinHash = await bcrypt.hash(pin, 10);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        pinHash,
        secretSalt: salt,
        secretIv: iv.toString("base64"),
        secretTag: tag.toString("base64"),
        secretData: encrypted.toString("base64"),
      },
    });

    projectRevalidate();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save credentials" };
  }
}

export async function revealProjectSecret(projectId: string, pin: string) {
  try {
    const userId = await getUserId();
    const project = await assertOwnsProject(userId, projectId);
    if (!project.pinHash || !project.secretSalt || !project.secretIv || !project.secretTag || !project.secretData) {
      return { error: "No credentials saved yet" };
    }

    const pinOk = await bcrypt.compare(pin, project.pinHash);
    if (!pinOk) return { error: "Incorrect PIN" };

    const key = deriveKey(pin, project.secretSalt);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(project.secretIv, "base64")
    );
    decipher.setAuthTag(Buffer.from(project.secretTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(project.secretData, "base64")),
      decipher.final(),
    ]);

    return { success: true, secretText: decrypted.toString("utf8") };
  } catch {
    return { error: "Unable to unlock credentials" };
  }
}
