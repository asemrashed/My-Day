"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  FileText,
  FolderKanban,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Save,
  Trash2,
  Unlock,
} from "lucide-react";
import toast from "react-hot-toast";
import DateInput from "@/components/DateInput";
import FormModal from "@/components/FormModal";
import FileAttachments, { uploadPendingFiles } from "@/components/FileAttachments";
import {
  createProject,
  deleteProject,
  revealProjectSecret,
  saveProjectSecret,
  updateProject,
  type ProjectPayload,
} from "@/app/actions/projects";

type ProjectItem = {
  id: string;
  title: string;
  group: string;
  status: string;
  problem: string | null;
  solution: string | null;
  features: string[];
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  notes: string | null;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

type RelatedNote = { id: string; title: string | null; content: string; updatedAt: string };
type RelatedTask = { id: string; title: string; status: string; priority: string; dueDate: string | null };
type RelatedEvent = { id: string; title: string; startAt: string; endAt: string; colorLabel: string };

type LinkMap = Record<string, { noteIds: string[]; taskIds: string[]; eventIds: string[] }>;

type ProjectsHubProps = {
  initialProjects: ProjectItem[];
  notes: RelatedNote[];
  tasks: RelatedTask[];
  events: RelatedEvent[];
  linkMap: LinkMap;
};

const STATUS_OPTIONS = ["PLANNED", "ACTIVE", "PAUSED", "DONE"];

const emptyForm: ProjectPayload = {
  title: "",
  group: "General",
  status: "PLANNED",
  problem: "",
  solution: "",
  features: [],
  techStack: [],
  repoUrl: "",
  liveUrl: "",
  notes: "",
  progress: 0,
  startDate: "",
  dueDate: "",
  noteIds: [],
  taskIds: [],
  eventIds: [],
};

function csvToList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(items: string[]) {
  return items.join("\n");
}

function htmlPreview(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}

function formatDate(date: string | null) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectsHub({ initialProjects, notes, tasks, events, linkMap }: ProjectsHubProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [selectedId, setSelectedId] = useState(initialProjects[0]?.id || "");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [form, setForm] = useState<ProjectPayload>(emptyForm);
  const [featuresText, setFeaturesText] = useState("");
  const [techText, setTechText] = useState("");
  const [pin, setPin] = useState("");
  const [secretText, setSecretText] = useState("");
  const [unlockedSecret, setUnlockedSecret] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const selected = projects.find((project) => project.id === selectedId) || projects[0] || null;
  const selectedLinks = selected ? linkMap[selected.id] || { noteIds: [], taskIds: [], eventIds: [] } : null;

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, ProjectItem[]>();
    for (const project of projects) {
      if (!groups.has(project.group)) groups.set(project.group, []);
      groups.get(project.group)!.push(project);
    }
    return Array.from(groups.entries()) as [string, ProjectItem[]][];
  }, [projects]);

  const linkedNotes = selectedLinks
    ? notes.filter((note) => selectedLinks.noteIds.includes(note.id))
    : [];
  const linkedTasks = selectedLinks
    ? tasks.filter((task) => selectedLinks.taskIds.includes(task.id))
    : [];
  const linkedEvents = selectedLinks
    ? events.filter((event) => selectedLinks.eventIds.includes(event.id))
    : [];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFeaturesText("");
    setTechText("");
    setPendingFiles([]);
    setShowForm(true);
  };

  const openEdit = (project: ProjectItem) => {
    setEditing(project);
    setPendingFiles([]);
    const links = linkMap[project.id] || { noteIds: [], taskIds: [], eventIds: [] };
    setForm({
      id: project.id,
      title: project.title,
      group: project.group,
      status: project.status,
      problem: project.problem || "",
      solution: project.solution || "",
      features: project.features,
      techStack: project.techStack,
      repoUrl: project.repoUrl || "",
      liveUrl: project.liveUrl || "",
      notes: project.notes || "",
      progress: project.progress,
      startDate: project.startDate?.slice(0, 10) || "",
      dueDate: project.dueDate?.slice(0, 10) || "",
      ...links,
    });
    setFeaturesText(listToText(project.features));
    setTechText(listToText(project.techStack));
    setShowForm(true);
  };

  const toggleLinkId = (key: "noteIds" | "taskIds" | "eventIds", id: string) => {
    setForm((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  };

  const handleSaveProject = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ProjectPayload = {
      ...form,
      features: csvToList(featuresText),
      techStack: csvToList(techText),
    };

    startTransition(async () => {
      const result = editing
        ? await updateProject(editing.id, payload)
        : await createProject(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const projectId = result.project?.id || editing?.id;
      if (projectId && pendingFiles.length > 0) {
        try {
          await uploadPendingFiles("PROJECT", projectId, pendingFiles);
        } catch {
          toast.error("Project saved, but some files failed to upload");
        }
      }

      toast.success(editing ? "Project updated" : "Project created");
      setPendingFiles([]);
      setShowForm(false);
      router.refresh();
      window.setTimeout(() => window.location.reload(), 150);
    });
  };

  const handleDelete = (project: ProjectItem) => {
    if (!confirm(`Delete project "${project.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setProjects((prev) => prev.filter((item) => item.id !== project.id));
      if (selectedId === project.id) setSelectedId(projects.find((item) => item.id !== project.id)?.id || "");
      toast.success("Project deleted");
      router.refresh();
    });
  };

  const handleSaveSecret = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await saveProjectSecret(selected.id, pin, secretText);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSecretText("");
      setPin("");
      setUnlockedSecret("");
      setProjects((prev) =>
        prev.map((project) => (project.id === selected.id ? { ...project, hasSecret: true } : project))
      );
      toast.success("Credentials encrypted and saved");
      router.refresh();
    });
  };

  const handleRevealSecret = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await revealProjectSecret(selected.id, pin);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setUnlockedSecret(result.secretText || "");
      toast.success("Credentials unlocked");
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Project Space</h2>
            <p className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={openCreate} className="app-button-primary text-xs flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="app-card text-center py-14">
            <FolderKanban className="h-10 w-10 mx-auto text-primary/50 mb-3" />
            <p className="font-semibold text-foreground">No projects yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a project to connect notes, tasks, schedule, and credentials.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedProjects.map(([group, groupProjects]) => (
              <section key={group} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary">{group}</h3>
                  <span className="text-[10px] text-muted-foreground">{groupProjects.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                  {groupProjects.map((project) => {
                    const active = selected?.id === project.id;
                    const links = linkMap[project.id] || { noteIds: [], taskIds: [], eventIds: [] };
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(project.id);
                          setUnlockedSecret("");
                          setPin("");
                        }}
                        className={`app-card p-4 text-left border transition-all ${
                          active
                            ? "border-primary/80 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/40 hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">{project.status}</p>
                            <h4 className="font-bold text-foreground truncate mt-1">{project.title}</h4>
                          </div>
                          {project.hasSecret && <Lock className="h-4 w-4 text-amber-400 shrink-0" />}
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          <span>{links.noteIds.length} notes</span>
                          <span>{links.taskIds.length} tasks</span>
                          <span>{links.eventIds.length} events</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="xl:col-span-8">
        {!selected ? (
          <div className="app-card py-20 text-center text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto opacity-20 mb-3" />
            <p className="text-sm font-semibold">Select or create a project</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="app-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{selected.group} / {selected.status}</p>
                  <h2 className="text-2xl font-extrabold text-foreground mt-1">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(selected.startDate)} → {formatDate(selected.dueDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selected)} className="app-icon-button" title="Edit project">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(selected)} className="app-icon-button hover:text-destructive" title="Delete project">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Problem</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.problem || "No problem statement added."}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Solution</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.solution || "No solution added."}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Features</p>
                  <div className="space-y-2">
                    {selected.features.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No features yet.</p>
                    ) : (
                      selected.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm">
                          <CheckSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Stack / Links</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selected.techStack.map((tech) => (
                      <span key={tech} className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.repoUrl && (
                      <Link href={selected.repoUrl} target="_blank" className="app-icon-button text-xs flex items-center gap-1.5">
                        <ExternalLink className="h-4 w-4" /> Repo
                      </Link>
                    )}
                    {selected.liveUrl && (
                      <Link href={selected.liveUrl} target="_blank" className="app-icon-button text-xs flex items-center gap-1.5">
                        <ExternalLink className="h-4 w-4" /> Live
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <RelatedCard icon={FileText} title="Notes" href="/notes">
                {linkedNotes.length === 0 ? (
                  <EmptyRelated label="No linked notes" />
                ) : (
                  linkedNotes.map((note) => (
                    <p key={note.id} className="text-xs text-muted-foreground border-b border-border/40 pb-2 last:border-0">
                      <span className="font-semibold text-foreground">{note.title || "Untitled Note"}</span>
                      <br />{htmlPreview(note.content)}
                    </p>
                  ))
                )}
              </RelatedCard>
              <RelatedCard icon={CheckSquare} title="Tasks" href="/tasks">
                {linkedTasks.length === 0 ? (
                  <EmptyRelated label="No linked tasks" />
                ) : (
                  linkedTasks.map((task) => (
                    <p key={task.id} className="text-xs text-muted-foreground border-b border-border/40 pb-2 last:border-0">
                      <span className="font-semibold text-foreground">{task.title}</span>
                      <br />{task.status} / {task.priority}
                    </p>
                  ))
                )}
              </RelatedCard>
              <RelatedCard icon={Calendar} title="Schedule" href="/schedule">
                {linkedEvents.length === 0 ? (
                  <EmptyRelated label="No linked events" />
                ) : (
                  linkedEvents.map((event) => (
                    <p key={event.id} className="text-xs text-muted-foreground border-b border-border/40 pb-2 last:border-0">
                      <span className="font-semibold text-foreground">{event.title}</span>
                      <br />{formatDate(event.startAt)}
                    </p>
                  ))
                )}
              </RelatedCard>
            </div>

            <div className="app-card">
              <FileAttachments ownerType="PROJECT" ownerId={selected.id} />
            </div>

            <div className="app-card border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-400" /> Encrypted Credentials
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Store ENV, API keys, passwords, and server credentials. PIN is required to unlock.
                  </p>
                </div>
                {selected.hasSecret ? <Lock className="h-5 w-5 text-amber-400" /> : <Unlock className="h-5 w-5 text-muted-foreground" />}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  className="app-input text-xs"
                />
                <button
                  type="button"
                  onClick={handleRevealSecret}
                  disabled={isPending || !selected.hasSecret}
                  className="app-button-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" /> Unlock
                </button>
              </div>

              <textarea
                value={unlockedSecret || secretText}
                onChange={(e) => {
                  setUnlockedSecret("");
                  setSecretText(e.target.value);
                }}
                placeholder={"ENV / credentials, e.g.\nDATABASE_URL=...\nADMIN_EMAIL=...\nServer: user@host"}
                className="app-input mt-3 min-h-40 text-xs font-mono resize-y"
              />
              <button
                type="button"
                onClick={handleSaveSecret}
                disabled={isPending}
                className="mt-3 app-button-primary text-xs flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" /> Encrypt & Save
              </button>
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setPendingFiles([]);
        }}
        title={editing ? "Edit Project" : "New Project"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProject} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Project Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="app-input text-xs"
                placeholder="Project name"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Group / Client">
                <input
                  value={form.group || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, group: e.target.value }))}
                  className="app-input text-xs"
                  placeholder="Work, Client, Personal"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="app-input text-xs"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Problem">
              <textarea
                value={form.problem || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, problem: e.target.value }))}
                className="app-input text-xs min-h-24 resize-y"
              />
            </Field>
            <Field label="Solution">
              <textarea
                value={form.solution || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, solution: e.target.value }))}
                className="app-input text-xs min-h-24 resize-y"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Features (one per line or comma separated)">
              <textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} className="app-input text-xs min-h-24 resize-y" />
            </Field>
            <Field label="Tech Stack (one per line or comma separated)">
              <textarea value={techText} onChange={(e) => setTechText(e.target.value)} className="app-input text-xs min-h-24 resize-y" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Progress %">
              <input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((prev) => ({ ...prev, progress: Number(e.target.value) }))}
                className="app-input text-xs"
              />
            </Field>
            <Field label="Start Date">
              <DateInput value={form.startDate || ""} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} className="text-xs" />
            </Field>
            <Field label="Due Date">
              <DateInput value={form.dueDate || ""} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} className="text-xs" />
            </Field>
            <Field label="Live URL">
              <input value={form.liveUrl || ""} onChange={(e) => setForm((prev) => ({ ...prev, liveUrl: e.target.value }))} className="app-input text-xs" />
            </Field>
          </div>

          <Field label="Repository URL">
            <input value={form.repoUrl || ""} onChange={(e) => setForm((prev) => ({ ...prev, repoUrl: e.target.value }))} className="app-input text-xs" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LinkPicker title="Link Notes" items={notes.map((n) => ({ id: n.id, label: n.title || "Untitled Note" }))} selected={form.noteIds || []} onToggle={(id) => toggleLinkId("noteIds", id)} />
            <LinkPicker title="Link Tasks" items={tasks.map((t) => ({ id: t.id, label: t.title }))} selected={form.taskIds || []} onToggle={(id) => toggleLinkId("taskIds", id)} />
            <LinkPicker title="Link Schedule" items={events.map((e) => ({ id: e.id, label: e.title }))} selected={form.eventIds || []} onToggle={(id) => toggleLinkId("eventIds", id)} />
          </div>

          <Field label="Project Notes">
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="app-input text-xs min-h-20 resize-y"
              placeholder="Setup commands, docs, handoff notes..."
            />
          </Field>

          <FileAttachments
            ownerType="PROJECT"
            ownerId={editing?.id}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            compact
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setPendingFiles([]); }} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="app-button-primary text-xs">
              {editing ? "Save Project" : "Create Project"}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

function LinkPicker({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">{title}</p>
      <div className="max-h-40 overflow-y-auto slim-scrollbar space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing to link yet.</p>
        ) : (
          items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2 py-1 hover:bg-background">
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
              <span className="truncate">{item.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function RelatedCard({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: typeof FileText;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        <Link href={href} className="text-[10px] font-bold text-primary hover:underline">Open</Link>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyRelated({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">{label}</p>;
}
