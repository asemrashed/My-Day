"use client";

import { useState, useTransition } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createTask, deleteTaskGroup, updateTaskGroup } from "@/app/actions/tasks";
import FormModal from "@/components/FormModal";
import TaskCard from "@/components/TaskCard";
import type { GoalOption, TaskGroupSummary, TaskView } from "@/lib/task-types";

type Props = {
  group: TaskGroupSummary;
  tasks: TaskView[];
  goals: GoalOption[];
  onRefresh: () => void;
};

export default function TaskGroupCard({ group, tasks, goals, onRefresh }: Props) {
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedGroupTitle, setEditedGroupTitle] = useState(group.title);
  const [editedTasks, setEditedTasks] = useState(
    tasks.map((task) => ({ id: task.id, title: task.title, priority: task.priority }))
  );
  const [isPending, startTransition] = useTransition();
  const completed = tasks.filter((task) => task.status === "DONE").length;
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createTask({ title, groupId: group.id });
      if (!result.success) {
        toast.error(result.error || "Failed to add task");
        return;
      }
      setTitle("");
      onRefresh();
    });
  };

  const openEditor = () => {
    setEditedGroupTitle(group.title);
    setEditedTasks(tasks.map((task) => ({ id: task.id, title: task.title, priority: task.priority })));
    setIsEditing(true);
  };

  const saveGroup = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTaskGroup(group.id, editedGroupTitle, editedTasks);
      if (!result.success) {
        toast.error(result.error || "Failed to update group");
        return;
      }
      toast.success("Task group updated");
      setIsEditing(false);
      onRefresh();
    });
  };

  const removeGroup = () => {
    if (!confirm(`Delete "${group.title}" and all ${tasks.length} tasks inside it?`)) return;
    startTransition(async () => {
      const result = await deleteTaskGroup(group.id);
      if (!result.success) {
        toast.error(result.error || "Failed to delete group");
        return;
      }
      toast.success("Task group deleted");
      onRefresh();
    });
  };

  return (
    <section className="app-card p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={() => setIsExpanded((current) => !current)} className="flex items-start gap-2 text-left">
          {isExpanded ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
          <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold text-foreground">{group.title}</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Group</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(group.groupDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs font-semibold text-muted-foreground">{completed} / {tasks.length} done</span>
          <button type="button" onClick={openEditor} className="p-2 text-muted-foreground hover:text-primary" title="Edit group">
            <Edit2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={removeGroup} className="p-2 text-muted-foreground hover:text-destructive" title="Delete group">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {isExpanded && <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} goals={goals} onRefresh={onRefresh} compact />
        ))}
        <form onSubmit={addItem} className="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add item to this group"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {title && (
            <button disabled={isPending} className="text-xs font-semibold text-primary disabled:opacity-50">
              Add
            </button>
          )}
        </form>
      </div>}

      <FormModal open={isEditing} onClose={() => setIsEditing(false)} title="Edit task group">
        <form onSubmit={saveGroup} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Group title</label>
            <input
              required
              value={editedGroupTitle}
              onChange={(event) => setEditedGroupTitle(event.target.value)}
              className="app-input px-4 py-2.5 font-semibold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">Tasks</label>
            {editedTasks.map((task, index) => (
              <div key={task.id} className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  required
                  value={task.title}
                  onChange={(event) =>
                    setEditedTasks((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item)
                    )
                  }
                  className="app-input px-3 py-2"
                />
                <select
                  value={task.priority}
                  onChange={(event) =>
                    setEditedTasks((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? { ...item, priority: event.target.value } : item)
                    )
                  }
                  className="app-input px-2 py-2 text-xs"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            ))}
          </div>
          <button disabled={isPending} className="app-button-primary w-full py-2.5 disabled:opacity-50">
            {isPending ? "Saving..." : "Save group and tasks"}
          </button>
        </form>
      </FormModal>
    </section>
  );
}
