"use client";

import { useState, useTransition } from "react";
import { createTask, createTaskGroup, updateTask } from "@/app/actions/tasks";
import { TASK_CATEGORIES, type GoalOption, type TaskView } from "@/lib/task-types";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";

type Props = {
  goals: GoalOption[];
  task?: TaskView;
  groupId?: string | null;
  initialGoalId?: string | null;
  initialSubGoalId?: string | null;
  onSuccess: () => void;
  submitLabel?: string;
};

export default function TaskForm({ goals, task, groupId, initialGoalId, initialSubGoalId, onSuccess, submitLabel }: Props) {
  const initialGoal = goals.find((goal) => goal.id === initialGoalId);
  const initialSubGoal = initialGoal?.subGoals.find((subGoal) => subGoal.id === initialSubGoalId);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title || initialSubGoal?.title || initialGoal?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  const [priority, setPriority] = useState(task?.priority || "MEDIUM");
  const [category, setCategory] = useState(task?.category || "Work");
  const [placement, setPlacement] = useState<"standalone" | "today" | "group">(
    groupId || task?.groupId ? "group" : "standalone"
  );
  const [goalId, setGoalId] = useState(task?.goalId || initialGoalId || "");
  const [subGoalId, setSubGoalId] = useState(task?.subGoalId || initialSubGoalId || "");
  const [addMultiple, setAddMultiple] = useState(false);
  const [additionalTitles, setAdditionalTitles] = useState<string[]>([""]);

  const selectedGoal = goals.find((goal) => goal.id === goalId);
  const taskCount = addMultiple && placement !== "standalone"
    ? additionalTitles.filter((item) => item.trim()).length
    : 1;

  const selectGoal = (nextGoalId: string) => {
    setGoalId(nextGoalId);
    setSubGoalId("");
    const nextGoal = goals.find((goal) => goal.id === nextGoalId);
    if (nextGoal) setTitle(nextGoal.title);
  };

  const selectSubGoal = (nextSubGoalId: string) => {
    setSubGoalId(nextSubGoalId);
    const nextSubGoal = selectedGoal?.subGoals.find((subGoal) => subGoal.id === nextSubGoalId);
    setTitle(nextSubGoal?.title || selectedGoal?.title || title);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return toast.error(addMultiple && placement !== "standalone" ? "Group title is required" : "Task title is required");
    }
    if (addMultiple && placement !== "standalone" && taskCount === 0) {
      return toast.error("Add at least one task to the group");
    }

    startTransition(async () => {
      const payload = {
        title,
        description,
        dueDate: dueDate || null,
        priority,
        category,
        groupId: placement === "group" ? groupId || task?.groupId || null : null,
        addToTodayGroup: placement === "today",
        goalId: goalId || null,
        subGoalId: goalId ? subGoalId || null : null,
        isRecurring: task?.isRecurring || false,
        recurringDays: task?.recurringDays || [],
        ...(task ? { status: task.status } : {}),
      };
      if (task) {
        const result = await updateTask(task.id, payload);
        if (!result.success) {
          toast.error(result.error || "Failed to save task");
          return;
        }
      } else {
        const isTaskGroup = addMultiple && placement !== "standalone";
        let destinationGroupId = placement === "group" ? groupId || null : null;
        if (isTaskGroup && !destinationGroupId) {
          const groupResult = await createTaskGroup(title);
          if (!groupResult.success || !groupResult.group) {
            toast.error(groupResult.error || "Failed to create task group");
            return;
          }
          destinationGroupId = groupResult.group.id;
        }
        const titles = isTaskGroup
          ? additionalTitles.map((item) => item.trim()).filter(Boolean)
          : [title.trim()];
        for (const itemTitle of titles) {
          const result = await createTask({
            ...payload,
            title: itemTitle,
            groupId: isTaskGroup ? destinationGroupId : payload.groupId,
            addToTodayGroup: isTaskGroup ? false : payload.addToTodayGroup,
          });
          if (!result.success) {
            toast.error(result.error || `Failed to create "${itemTitle}"`);
            return;
          }
        }
      }
      toast.success(task ? "Task updated" : addMultiple && placement !== "standalone" ? "Task group created" : "Task created");
      onSuccess();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setPlacement("standalone");
              setAddMultiple(false);
            }}
            className={`app-input py-2.5 ${placement === "standalone" ? "border-primary text-primary" : ""}`}
          >
            Singular
          </button>
          <button
            type="button"
            onClick={() => setPlacement(groupId || task?.groupId ? "group" : "today")}
            className={`app-input py-2.5 ${placement !== "standalone" ? "border-primary text-primary" : ""}`}
          >
            {groupId || task?.groupId ? "Keep in this group" : "Add to today's group"}
          </button>
        </div>
      </div>

      {!task && placement !== "standalone" && (
        <button
          type="button"
          onClick={() => setAddMultiple((current) => !current)}
          className={`app-input px-4 py-2.5 flex items-center justify-between ${
            addMultiple ? "border-primary text-primary" : "text-muted-foreground"
          }`}
        >
          <span className="font-semibold">Add multiple tasks</span>
          <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${addMultiple ? "bg-primary" : "bg-muted"}`}>
            <span className={`block h-4 w-4 rounded-full bg-background transition-transform ${addMultiple ? "translate-x-4" : ""}`} />
          </span>
        </button>
      )}

      <div className="border-t border-border pt-4 space-y-3">
        <label className="text-xs font-semibold text-muted-foreground block">Goals & sub-goals (optional)</label>
        <select value={goalId} onChange={(event) => selectGoal(event.target.value)} className="app-input px-4 py-2.5">
          <option value="">No goal</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>{goal.title}</option>
          ))}
        </select>
        {selectedGoal && selectedGoal.subGoals.length > 0 && (
          <select value={subGoalId} onChange={(event) => selectSubGoal(event.target.value)} className="app-input px-4 py-2.5">
            <option value="">Whole goal</option>
            {selectedGoal.subGoals.map((subGoal) => (
              <option key={subGoal.id} value={subGoal.id}>{subGoal.title}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground block">
          {addMultiple && placement !== "standalone" ? "Group title" : "Title"}
        </label>
        <input
          autoFocus
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to be done?"
          className="app-input px-4 py-2.5 font-semibold"
        />
        {addMultiple && placement !== "standalone" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block pt-2">Tasks</label>
            {additionalTitles.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={item}
                  onChange={(event) =>
                    setAdditionalTitles((current) =>
                      current.map((titleItem, itemIndex) => itemIndex === index ? event.target.value : titleItem)
                    )
                  }
                  placeholder={`Task ${index + 1}`}
                  className="app-input px-4 py-2.5"
                />
                {additionalTitles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAdditionalTitles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Remove task"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAdditionalTitles((current) => [...current, ""])}
              className="text-xs font-semibold text-primary flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add another task
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Priority</label>
        <div className="grid grid-cols-3 gap-2">
          {["HIGH", "MEDIUM", "LOW"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={`app-input py-2.5 capitalize ${priority === value ? "border-primary text-primary" : ""}`}
            >
              {value.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-muted-foreground">Notes, due date and category</summary>
        <div className="mt-3 space-y-3">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="app-input px-4 py-2.5 resize-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="app-input px-4 py-2.5"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-input px-4 py-2.5">
              {TASK_CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <button type="submit" disabled={isPending} className="app-button-primary w-full py-2.5 disabled:opacity-50">
        {isPending
          ? "Saving..."
          : submitLabel ||
            (task
              ? "Save changes"
              : addMultiple && placement !== "standalone"
                ? `Create group${taskCount > 0 ? ` with ${taskCount} task${taskCount === 1 ? "" : "s"}` : ""}`
                : "Create task")}
      </button>
    </form>
  );
}
