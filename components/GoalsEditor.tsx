"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Edit2, Plus, Target, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTask, toggleTaskStatus } from "@/app/actions/tasks";
import FormModal from "@/components/FormModal";
import TaskForm from "@/components/TaskForm";
import type { TaskView } from "@/lib/task-types";
import { useGoalOptions, useInvalidateAppQueries } from "@/hooks/useAppQueries";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  period: string;
  dueDate: string | null;
  progress: number;
  isCompleted: boolean;
  createdAt: string;
  parentGoalId: string | null;
  tasks: TaskView[];
  subGoals?: Goal[];
  tasksLoaded?: boolean;
  tasksLoading?: boolean;
};

const PAGE_SIZE = 6;

function descriptionText(value: string | null) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.text === "string" ? parsed.text : "";
  } catch {
    return value;
  }
}

function descriptionPayload(value: string | null, text: string) {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return { ...parsed, text, checklist: [] };
      }
    } catch {
      // Legacy plain text is replaced by the edited text below.
    }
  }
  return { text, checklist: [], links: [], images: [] };
}

function normalizeGoal(goal: Goal): Goal {
  return {
    ...goal,
    tasks: goal.tasks || [],
    tasksLoaded: goal.tasksLoaded ?? false,
    tasksLoading: false,
    subGoals: (goal.subGoals || []).map((sub) => ({
      ...sub,
      tasks: sub.tasks || [],
      tasksLoaded: sub.tasksLoaded ?? false,
      tasksLoading: false,
    })),
  };
}

export default function GoalsEditor() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data: goalOptions = [] } = useGoalOptions();
  const { invalidateGoals, invalidateTasks } = useInvalidateAppQueries();
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(() => new Set());
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [taskGoal, setTaskGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("WEEKLY");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [parentGoalId, setParentGoalId] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const syncGoalCaches = useCallback(async () => {
    await invalidateGoals();
  }, [invalidateGoals]);

  const fetchPage = useCallback(async (cursor?: string | null, replace = false) => {
    if (replace) setLoading(true);
    else {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ mode: "list", limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/goals?${params}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const list: Goal[] = Array.isArray(data.goals) ? data.goals.map(normalizeGoal) : [];
      setGoals((current) => {
        const merged = replace ? list : [...current, ...list];
        const byId = new Map<string, Goal>();
        for (const goal of merged) byId.set(goal.id, goal);
        return Array.from(byId.values());
      });
      setNextCursor(data.nextCursor || null);
    } catch {
      if (replace) toast.error("Failed to load goals");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const collected: Goal[] = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ mode: "list", limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/goals?${params}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        const list: Goal[] = Array.isArray(data.goals) ? data.goals.map(normalizeGoal) : [];
        collected.push(...list);
        cursor = data.nextCursor || null;
      } while (cursor);

      const byId = new Map<string, Goal>();
      for (const goal of collected) byId.set(goal.id, goal);
      setGoals(Array.from(byId.values()));
      setNextCursor(null);
    } catch {
      toast.error("Failed to load goals");
      setGoals([]);
    } finally {
      setLoading(false);
    }
    await syncGoalCaches();
  }, [syncGoalCaches]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const collected: Goal[] = [];
        let cursor: string | null = null;
        do {
          if (cancelled) return;
          const params = new URLSearchParams({ mode: "list", limit: String(PAGE_SIZE) });
          if (cursor) params.set("cursor", cursor);
          const response = await fetch(`/api/goals?${params}`);
          if (!response.ok) throw new Error();
          const data = await response.json();
          const list: Goal[] = Array.isArray(data.goals) ? data.goals.map(normalizeGoal) : [];
          collected.push(...list);
          cursor = data.nextCursor || null;
        } while (cursor);
        if (cancelled) return;
        const byId = new Map<string, Goal>();
        for (const goal of collected) byId.set(goal.id, goal);
        setGoals(Array.from(byId.values()));
        setNextCursor(null);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load goals");
          setGoals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fetchPage(nextCursor);
      },
      { rootMargin: "240px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, fetchPage, goals.length]);

  const rootGoals = goals;

  const openCreate = (parentId = "") => {
    setEditing(null);
    setTitle("");
    setPeriod("WEEKLY");
    setDueDate("");
    setDescription("");
    setParentGoalId(parentId);
    setShowGoalForm(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setTitle(goal.title);
    setPeriod(goal.period);
    setDueDate(goal.dueDate?.slice(0, 10) || "");
    setDescription(descriptionText(goal.description));
    setParentGoalId(goal.parentGoalId || "");
    setShowGoalForm(true);
  };

  const saveGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/goals", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing?.id,
        title,
        period,
        dueDate: dueDate || null,
        parentGoalId: parentGoalId || null,
        description: JSON.stringify(descriptionPayload(editing?.description || null, description.trim())),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return toast.error(body.error || "Failed to save goal");
    }
    setShowGoalForm(false);
    toast.success(editing ? "Goal updated" : "Goal created");
    refreshAll();
  };

  const removeGoal = async (goal: Goal) => {
    if (!confirm(`Delete "${goal.title}"? Linked tasks will be kept.`)) return;
    const response = await fetch(`/api/goals?id=${goal.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Failed to delete goal");
    setGoals((current) =>
      current
        .filter((item) => item.id !== goal.id)
        .map((item) => ({
          ...item,
          subGoals: (item.subGoals || []).filter((sub) => sub.id !== goal.id),
        }))
    );
    void syncGoalCaches();
  };

  const patchGoalTree = (goalId: string, patch: Partial<Goal>) => {
    setGoals((current) =>
      current.map((goal) => {
        if (goal.id === goalId) return { ...goal, ...patch };
        return {
          ...goal,
          subGoals: (goal.subGoals || []).map((sub) => (sub.id === goalId ? { ...sub, ...patch } : sub)),
        };
      })
    );
  };

  const loadTasks = async (goal: Goal, force = false) => {
    if (!force && (goal.tasksLoaded || goal.tasksLoading)) return;
    patchGoalTree(goal.id, { tasksLoading: true });
    try {
      const response = await fetch(`/api/goals/${goal.id}/tasks`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      patchGoalTree(goal.id, {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        tasksLoaded: true,
        tasksLoading: false,
      });
    } catch {
      patchGoalTree(goal.id, { tasksLoading: false });
      toast.error("Failed to load tasks");
    }
  };

  const applyGoalProgress = (updates?: Array<{ id: string; progress: number; isCompleted: boolean }>) => {
    if (!updates?.length) return;
    const byId = new Map(updates.map((update) => [update.id, update]));
    setGoals((current) =>
      current.map((goal) => {
        const update = byId.get(goal.id);
        const next = update ? { ...goal, progress: update.progress, isCompleted: update.isCompleted } : goal;
        return {
          ...next,
          subGoals: (next.subGoals || []).map((sub) => {
            const subUpdate = byId.get(sub.id);
            return subUpdate ? { ...sub, progress: subUpdate.progress, isCompleted: subUpdate.isCompleted } : sub;
          }),
        };
      })
    );
  };

  const mapTasksInTree = (taskId: string, mapper: (task: TaskView) => TaskView | null) => {
    setGoals((current) =>
      current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((task) => (task.id === taskId ? mapper(task) || task : task)).filter(Boolean) as TaskView[],
        subGoals: (goal.subGoals || []).map((sub) => ({
          ...sub,
          tasks: sub.tasks.map((task) => (task.id === taskId ? mapper(task) || task : task)).filter(Boolean) as TaskView[],
        })),
      }))
    );
  };

  const toggleTask = async (task: TaskView) => {
    const previous = task.status;
    const nextStatus = previous === "DONE" ? "PENDING" : "DONE";
    mapTasksInTree(task.id, (item) => ({ ...item, status: nextStatus }));
    const result = await toggleTaskStatus(task.id, previous);
    if (!result.success) {
      mapTasksInTree(task.id, (item) => ({ ...item, status: previous }));
      return toast.error(result.error || "Failed to update task");
    }
    if (result.task) mapTasksInTree(result.task.id, (item) => ({ ...item, status: result.task!.status }));
    applyGoalProgress(result.goals);
    void invalidateGoals();
  };

  const removeTask = async (task: TaskView) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const result = await deleteTask(task.id);
    if (!result.success) return toast.error(result.error || "Failed to delete task");
    setGoals((current) =>
      current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.filter((item) => item.id !== task.id),
        subGoals: (goal.subGoals || []).map((sub) => ({
          ...sub,
          tasks: sub.tasks.filter((item) => item.id !== task.id),
        })),
      }))
    );
    applyGoalProgress(result.goals);
    void invalidateGoals();
    void invalidateTasks();
  };

  const toggleExpanded = (goal: Goal) => {
    setExpandedGoals((current) => {
      const next = new Set(current);
      if (next.has(goal.id)) next.delete(goal.id);
      else {
        next.add(goal.id);
        void loadTasks(goal);
      }
      return next;
    });
  };

  const renderTasks = (goal: Goal) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {goal.tasksLoading && !goal.tasksLoaded ? (
        <p className="text-xs text-muted-foreground col-span-full py-2">Loading tasks…</p>
      ) : (
        goal.tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
            <input type="checkbox" checked={task.status === "DONE"} onChange={() => toggleTask(task)} className="h-4 w-4 accent-primary" />
            <span className={`min-w-0 flex-1 truncate text-sm ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
            <span className="text-[9px] font-bold text-muted-foreground">{task.priority}</span>
            <button onClick={() => removeTask(task)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
      <button
        onClick={() => setTaskGoal(goal)}
        className="border border-dashed border-border rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        <Plus className="inline h-3.5 w-3.5 mr-1" /> Add linked task
      </button>
    </div>
  );

  const renderSubGoal = (goal: Goal) => {
    const isExpanded = expandedGoals.has(goal.id);
    return (
      <div key={goal.id} className="border-b border-border/70 last:border-b-0">
        <div className="flex items-center gap-2 py-2 px-2">
          <button onClick={() => toggleExpanded(goal)} className="p-1 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => toggleExpanded(goal)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">{goal.title}</span>
          </button>
          <span className="hidden sm:block text-[10px] uppercase text-muted-foreground">{goal.period}</span>
          <span className="w-20 text-right text-[10px] text-muted-foreground">{goal.progress}% complete</span>
          <button onClick={() => openEdit(goal)} className="p-1.5 text-muted-foreground hover:text-primary">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => removeGoal(goal)} className="p-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {isExpanded && (
          <div className="px-8 pb-3 space-y-2">
            {descriptionText(goal.description) && <p className="text-xs text-muted-foreground">{descriptionText(goal.description)}</p>}
            {renderTasks(goal)}
          </div>
        )}
      </div>
    );
  };

  const renderGoal = (goal: Goal) => {
    const children = goal.subGoals || [];
    const isExpanded = expandedGoals.has(goal.id);
    return (
      <div key={goal.id} className="app-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <button onClick={() => toggleExpanded(goal)} className="min-w-0 flex flex-1 items-start gap-2 text-left">
            {isExpanded ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />}
            <div className="min-w-0">
              <h3 className="font-bold text-foreground truncate">{goal.title}</h3>
              <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="uppercase font-semibold">{goal.period}</span>
                {goal.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {new Date(goal.dueDate).toLocaleDateString()}
                  </span>
                )}
                <span>{goal.progress}% complete</span>
              </div>
            </div>
          </button>
          <div className="flex">
            <button onClick={() => openCreate(goal.id)} className="p-2 text-muted-foreground hover:text-primary" title="Add sub-goal">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={() => openEdit(goal)} className="p-2 text-muted-foreground hover:text-primary">
              <Edit2 className="h-4 w-4" />
            </button>
            <button onClick={() => removeGoal(goal)} className="p-2 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${goal.progress}%` }} />
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-2">
            {descriptionText(goal.description) && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{descriptionText(goal.description)}</p>}
            {renderTasks(goal)}
            {children.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/40 px-3 py-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                  <span>Sub-goals</span>
                  <span>{children.length} total</span>
                </div>
                <div>{children.map(renderSubGoal)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="app-card p-10 text-center text-muted-foreground">Loading goals...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => openCreate()} className="app-button-primary px-4 py-2.5 text-xs flex items-center gap-2">
          <Target className="h-4 w-4" /> Add goal
        </button>
      </div>

      {rootGoals.length === 0 ? (
        <div className="app-card p-12 text-center text-muted-foreground">No goals yet. Goals can start empty and receive tasks later.</div>
      ) : (
        <div className="space-y-3">
          {rootGoals.map((goal) => renderGoal(goal))}
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && <p className="text-center text-xs text-muted-foreground py-2">Loading more…</p>}
        </div>
      )}

      <FormModal open={showGoalForm} onClose={() => setShowGoalForm(false)} title={editing ? "Edit goal" : parentGoalId ? "New sub-goal" : "New goal"}>
        <form onSubmit={saveGoal} className="space-y-4">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" className="app-input px-4 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="app-input px-4 py-2.5">
              {["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="app-input px-4 py-2.5" />
          </div>
          <select value={parentGoalId} onChange={(event) => setParentGoalId(event.target.value)} className="app-input px-4 py-2.5">
            <option value="">No parent goal</option>
            {goalOptions
              .filter((goal) => goal.id !== editing?.id)
              .map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
          </select>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" rows={4} className="app-input px-4 py-2.5 resize-none" />
          <button className="app-button-primary w-full py-2.5">Save goal</button>
        </form>
      </FormModal>

      <FormModal open={Boolean(taskGoal)} onClose={() => setTaskGoal(null)} title="Add task to goal">
        {taskGoal && (
          <TaskForm
            goals={goalOptions}
            initialGoalId={taskGoal.parentGoalId || taskGoal.id}
            initialSubGoalId={taskGoal.parentGoalId ? taskGoal.id : null}
            onSuccess={() => {
              const target = taskGoal;
              setTaskGoal(null);
              void loadTasks({ ...target, tasksLoaded: false, tasksLoading: false }, true);
              void syncGoalCaches();
              void invalidateTasks();
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
