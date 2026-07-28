"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Edit2, GripVertical, Target, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTask, toggleTaskStatus } from "@/app/actions/tasks";
import FormModal from "@/components/FormModal";
import TaskForm from "@/components/TaskForm";
import type { GoalOption, TaskView } from "@/lib/task-types";

type Props = {
  task: TaskView;
  goals: GoalOption[];
  onRefresh: () => void;
  onTaskUpdated?: (patch: Pick<TaskView, "id" | "status">) => void;
  compact?: boolean;
};

function priorityClass(priority: string) {
  if (priority === "HIGH") return "bg-rose-950/20 text-rose-500 border-rose-500/20";
  if (priority === "MEDIUM") return "bg-amber-950/20 text-amber-500 border-amber-500/20";
  return "bg-primary/10 text-primary border-primary/20";
}

export default function TaskCard({ task, goals, onRefresh, onTaskUpdated, compact = false }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const sortable = useSortable({ id: task.id, disabled: compact });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };
  const linkedGoal = task.subGoal || task.goal;
  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const toggle = async () => {
    if (pending) return;
    const previous = task.status;
    const nextStatus = previous === "DONE" ? "PENDING" : "DONE";
    onTaskUpdated?.({ id: task.id, status: nextStatus });
    setPending(true);
    try {
      const result = await toggleTaskStatus(task.id, previous);
      if (!result.success) {
        onTaskUpdated?.({ id: task.id, status: previous });
        toast.error(result.error || "Failed to update task");
        return;
      }
      if (result.task) onTaskUpdated?.(result.task);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const result = await deleteTask(task.id);
    if (!result.success) return toast.error(result.error || "Failed to delete task");
    toast.success("Task deleted");
    onRefresh();
  };

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={style}
        className={`${compact ? "flex items-center px-3 py-2.5 border border-border/70 rounded-xl" : "app-card-compact"} flex items-center justify-between gap-3 ${
          task.status === "DONE" ? "opacity-60" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!compact && (
            <button
              {...sortable.attributes}
              {...sortable.listeners}
              className="p-1 rounded hover:bg-muted text-muted-foreground cursor-grab"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <input
            type="checkbox"
            checked={task.status === "DONE"}
            onChange={toggle}
            disabled={pending}
            className="h-5 w-5 rounded border-border accent-primary shrink-0 cursor-pointer disabled:opacity-50"
          />
          <div className="min-w-0 flex-1">
            <h4 className={`text-sm font-semibold truncate ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </h4>
            {!compact && task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${priorityClass(task.priority)}`}>
                {task.priority}
              </span>
              {!compact && (
                <span className="text-[9px] font-semibold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                  {task.category}
                </span>
              )}
              {formattedDate && !compact && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formattedDate}
                </span>
              )}
              {linkedGoal && (
                <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {task.subGoal ? `${task.goal?.title}: ${task.subGoal.title}` : linkedGoal.title}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0">
          <button onClick={() => setIsEditing(true)} className="p-2 text-muted-foreground hover:text-primary" title="Edit task">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={remove} className="p-2 text-muted-foreground hover:text-destructive" title="Delete task">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <FormModal open={isEditing} onClose={() => setIsEditing(false)} title="Edit task">
        <TaskForm
          goals={goals}
          task={task}
          groupId={task.groupId}
          onSuccess={() => {
            setIsEditing(false);
            onRefresh();
          }}
        />
      </FormModal>
    </>
  );
}
