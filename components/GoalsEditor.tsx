"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Edit2, Plus, Target, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTask, toggleTaskStatus } from "@/app/actions/tasks";
import FormModal from "@/components/FormModal";
import TaskForm from "@/components/TaskForm";
import type { GoalOption, TaskView } from "@/lib/task-types";

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
};

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

export default function GoalsEditor() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(() => new Set());
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [taskGoal, setTaskGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("WEEKLY");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [parentGoalId, setParentGoalId] = useState("");

  const fetchGoals = async () => {
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) throw new Error();
      setGoals(await response.json());
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const rootGoals = useMemo(() => goals.filter((goal) => !goal.parentGoalId), [goals]);
  const goalOptions: GoalOption[] = useMemo(
    () =>
      rootGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        period: goal.period,
        parentGoalId: null,
        subGoals: goals
          .filter((candidate) => candidate.parentGoalId === goal.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map(({ id, title, period, parentGoalId }) => ({ id, title, period, parentGoalId })),
      })),
    [goals, rootGoals]
  );

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
    fetchGoals();
  };

  const removeGoal = async (goal: Goal) => {
    if (!confirm(`Delete "${goal.title}"? Linked tasks will be kept.`)) return;
    const response = await fetch(`/api/goals?id=${goal.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Failed to delete goal");
    fetchGoals();
  };

  const toggleTask = async (task: TaskView) => {
    const result = await toggleTaskStatus(task.id, task.status);
    if (!result.success) return toast.error(result.error || "Failed to update task");
    fetchGoals();
  };

  const removeTask = async (task: TaskView) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const result = await deleteTask(task.id);
    if (!result.success) return toast.error(result.error || "Failed to delete task");
    fetchGoals();
  };

  const toggleExpanded = (goalId: string) => {
    setExpandedGoals((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const renderTasks = (goal: Goal) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {goal.tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
          <input type="checkbox" checked={task.status === "DONE"} onChange={() => toggleTask(task)} className="h-4 w-4 accent-primary" />
          <span className={`min-w-0 flex-1 truncate text-sm ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
          <span className="text-[9px] font-bold text-muted-foreground">{task.priority}</span>
          <button onClick={() => removeTask(task)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => setTaskGoal(goal)} className="border border-dashed border-border rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:text-primary">
        <Plus className="inline h-3.5 w-3.5 mr-1" /> Add linked task
      </button>
    </div>
  );

  const renderSubGoal = (goal: Goal) => {
    const isExpanded = expandedGoals.has(goal.id);
    return (
      <div key={goal.id} className="border-b border-border/70 last:border-b-0">
        <div className="flex items-center gap-2 py-2 px-2">
          <button onClick={() => toggleExpanded(goal.id)} className="p-1 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => toggleExpanded(goal.id)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">{goal.title}</span>
          </button>
          <span className="hidden sm:block text-[10px] uppercase text-muted-foreground">{goal.period}</span>
          <span className="w-20 text-right text-[10px] text-muted-foreground">{goal.progress}% complete</span>
          <button onClick={() => openEdit(goal)} className="p-1.5 text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => removeGoal(goal)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
    const children = goals
      .filter((candidate) => candidate.parentGoalId === goal.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const isExpanded = expandedGoals.has(goal.id);
    return (
      <div key={goal.id} className="app-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <button onClick={() => toggleExpanded(goal.id)} className="min-w-0 flex flex-1 items-start gap-2 text-left">
            {isExpanded ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />}
            <div className="min-w-0">
              <h3 className="font-bold text-foreground truncate">{goal.title}</h3>
              <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="uppercase font-semibold">{goal.period}</span>
                {goal.dueDate && (
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(goal.dueDate).toLocaleDateString()}</span>
                )}
                <span>{goal.progress}% complete</span>
              </div>
            </div>
          </button>
          <div className="flex">
            <button onClick={() => openCreate(goal.id)} className="p-2 text-muted-foreground hover:text-primary" title="Add sub-goal"><Plus className="h-4 w-4" /></button>
            <button onClick={() => openEdit(goal)} className="p-2 text-muted-foreground hover:text-primary"><Edit2 className="h-4 w-4" /></button>
            <button onClick={() => removeGoal(goal)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
        <div className="space-y-3">{rootGoals.map((goal) => renderGoal(goal))}</div>
      )}

      <FormModal open={showGoalForm} onClose={() => setShowGoalForm(false)} title={editing ? "Edit goal" : parentGoalId ? "New sub-goal" : "New goal"}>
        <form onSubmit={saveGoal} className="space-y-4">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" className="app-input px-4 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="app-input px-4 py-2.5">
              {["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="app-input px-4 py-2.5" />
          </div>
          <select value={parentGoalId} onChange={(event) => setParentGoalId(event.target.value)} className="app-input px-4 py-2.5">
            <option value="">No parent goal</option>
            {rootGoals.filter((goal) => goal.id !== editing?.id).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
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
              setTaskGoal(null);
              fetchGoals();
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
