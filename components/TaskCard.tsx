"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toggleTaskStatus, deleteTask, updateTask } from "@/app/actions/tasks";
import { GripVertical, Trash2, Edit2, X, Clock, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | Date | null;
  priority: string;
  category: string;
  status: string;
  isRecurring: boolean;
  recurringDays: string[];
}

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
}

const taskCategories = ["Work", "Personal", "Learning", "Health", "Shopping", "Other"];

export default function TaskCard({ task, onRefresh }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDesc, setEditedDesc] = useState(task.description || "");
  const [editedPriority, setEditedPriority] = useState(task.priority);
  const [editedCategory, setEditedCategory] = useState(task.category);
  const [editedDueDate, setEditedDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ""
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Toggle checklist status
  const handleToggle = async () => {
    try {
      const res = await toggleTaskStatus(task.id, task.status);
      if (res.success) {
        toast.success(task.status === "DONE" ? "Task active again!" : "Task completed! 🎉");
        onRefresh();
      } else {
        toast.error(res.error || "Failed to toggle task");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete task
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this task?")) {
      const res = await deleteTask(task.id);
      if (res.success) {
        toast.success("Task deleted");
        onRefresh();
      } else {
        toast.error(res.error || "Failed to delete task");
      }
    }
  };

  // Update task
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedTitle) {
      toast.error("Title is required");
      return;
    }

    const res = await updateTask(task.id, {
      title: editedTitle,
      description: editedDesc,
      priority: editedPriority,
      category: editedCategory,
      dueDate: editedDueDate,
      status: task.status,
    });

    if (res.success) {
      toast.success("Task updated");
      setIsEditing(false);
      onRefresh();
    } else {
      toast.error(res.error || "Failed to update task");
    }
  };

  // Priority color formatting helper
  const getPriorityColor = (p: string) => {
    switch (p) {
      case "HIGH":
        return "bg-rose-950/20 text-rose-500 border border-rose-500/20";
      case "MEDIUM":
        return "bg-amber-950/20 text-amber-500 border border-amber-500/20";
      case "LOW":
      default:
        return "bg-primary/10 text-primary border border-primary/20";
    }
  };

  // Render Inline Edit Form
  if (isEditing) {
    return (
      <div className="app-card-compact p-5 w-full">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-sm font-bold text-card-foreground">Edit Task</h4>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            required
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="app-input text-xs font-semibold"
            placeholder="Task title"
          />

          <textarea
            value={editedDesc}
            onChange={(e) => setEditedDesc(e.target.value)}
            className="app-input text-xs resize-none"
            placeholder="Description"
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Priority</label>
              <select
                value={editedPriority}
                onChange={(e) => setEditedPriority(e.target.value)}
                className="app-input text-xs"
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Category</label>
              <select
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value)}
                className="app-input text-xs"
              >
                {taskCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={editedDueDate}
              onChange={(e) => setEditedDueDate(e.target.value)}
              className="app-input text-xs"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-button-primary px-4 py-1.5 text-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Format date readable
  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`app-card-compact flex items-center justify-between gap-4 transition-all duration-300 ${
        task.status === "DONE" ? "opacity-60 border-primary/20" : ""
      }`}
    >
      {/* Draggable grip and Content */}
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === "DONE"}
          onChange={handleToggle}
          className="h-5 w-5 rounded border-border focus:ring-primary accent-primary shrink-0 cursor-pointer"
        />

        {/* Info */}
        <div className="overflow-hidden">
          <h4 className={`text-sm font-semibold truncate ${
            task.status === "DONE" 
              ? "line-through text-muted-foreground" 
              : "text-foreground"
          }`}>
            {task.title}
          </h4>
          {task.description && (
            <p className={`text-xs truncate ${
              task.status === "DONE" ? "text-muted-foreground" : "text-muted-foreground"
            }`}>
              {task.description}
            </p>
          )}

          {/* Subtags */}
          <div className="flex flex-wrap gap-2 mt-1.5 items-center">
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
              getPriorityColor(task.priority)
            }`}>
              {task.priority}
            </span>
            <span className="text-[9px] font-semibold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded">
              {task.category}
            </span>
            {formattedDate && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                {formattedDate}
              </span>
            )}
            {task.isRecurring && (
              <span className="text-[9px] font-semibold text-primary flex items-center gap-0.5" title="Recurring Task">
                <RefreshCw className="h-2.5 w-2.5" />
                Daily
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted active:scale-90 transition-all"
          title="Edit Task"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
          title="Delete Task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
