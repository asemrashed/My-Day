"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Filter, ListTodo, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { reorderTasks } from "@/app/actions/tasks";
import FormModal from "@/components/FormModal";
import TaskCard from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";
import TaskGroupCard from "@/components/TaskGroupCard";
import { useInvalidateAppQueries, useTasksBoard } from "@/hooks/useAppQueries";
import { queryKeys, type TasksBoardData } from "@/lib/queries";
import type { GoalOption, TaskGroupSummary, TaskView } from "@/lib/task-types";

type Props = {
  initialTasks: TaskView[];
  initialGroups: TaskGroupSummary[];
  goals: GoalOption[];
};

export default function TaskBoard({ initialTasks, initialGroups, goals }: Props) {
  const queryClient = useQueryClient();
  const { invalidateTasks } = useInvalidateAppQueries();
  const { data, refetch } = useTasksBoard({ tasks: initialTasks, groups: initialGroups });
  const tasks = data?.tasks ?? initialTasks;
  const groups = data?.groups ?? initialGroups;
  const [view, setView] = useState<"all" | "groups" | "singular">("all");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = useCallback(async () => {
    const result = await refetch();
    if (result.error) toast.error("Failed to refresh tasks");
    void invalidateTasks();
  }, [refetch, invalidateTasks]);

  const patchTask = useCallback(
    (patch: Pick<TaskView, "id" | "status">) => {
      queryClient.setQueryData<TasksBoardData>(queryKeys.tasks.board, (current) => {
        if (!current) return current;
        return {
          ...current,
          tasks: current.tasks.map((task) => (task.id === patch.id ? { ...task, status: patch.status } : task)),
        };
      });
    },
    [queryClient]
  );

  useEffect(() => {
    window.addEventListener("tasks:changed", refresh);
    return () => window.removeEventListener("tasks:changed", refresh);
  }, [refresh]);

  const filtered = tasks.filter((task) => {
    if (priority !== "all" && task.priority !== priority) return false;
    if (status !== "all" && task.status !== status) return false;
    return true;
  });
  const singularTasks = filtered.filter((task) => !task.groupId);
  const visibleGroups = groups.filter((group) => filtered.some((task) => task.groupId === group.id));

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = tasks.findIndex((task) => task.id === event.active.id);
    const newIndex = tasks.findIndex((task) => task.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    queryClient.setQueryData<TasksBoardData>(queryKeys.tasks.board, (current) =>
      current ? { ...current, tasks: reordered } : { tasks: reordered, groups }
    );
    reorderTasks(reordered.map((task) => task.id)).then((result) => {
      if (!result.success) {
        toast.error("Failed to save task order");
        refresh();
      }
    });
  };

  const isEmpty =
    (view === "groups" && visibleGroups.length === 0) ||
    (view === "singular" && singularTasks.length === 0) ||
    (view === "all" && visibleGroups.length === 0 && singularTasks.length === 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex w-fit bg-muted p-1 rounded-xl border border-border">
          {(["all", "groups", "singular"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                view === item ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="app-button-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Add task
        </button>
      </div>

      <div className="app-panel flex flex-wrap items-center gap-3 p-3 text-xs">
        <Filter className="h-4 w-4 text-primary" />
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className="app-input w-auto px-3 py-1.5">
          <option value="all">All priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="app-input w-auto px-3 py-1.5">
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DONE">Done</option>
        </select>
      </div>

      {isEmpty ? (
        <div className="app-card p-12 text-center text-muted-foreground">
          <ListTodo className="h-14 w-14 mx-auto opacity-20 mb-3" />
          <p className="font-semibold">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(view === "all" || view === "groups") &&
            visibleGroups.map((group) => (
              <TaskGroupCard
                key={group.id}
                group={group}
                tasks={filtered.filter((task) => task.groupId === group.id)}
                goals={goals}
                onRefresh={refresh}
                onTaskUpdated={patchTask}
              />
            ))}

          {(view === "all" || view === "singular") && singularTasks.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={singularTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {singularTasks.map((task) => (
                    <TaskCard key={task.id} task={task} goals={goals} onRefresh={refresh} onTaskUpdated={patchTask} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      <FormModal open={showForm} onClose={() => setShowForm(false)} title="New task">
        <TaskForm
          goals={goals}
          onSuccess={() => {
            setShowForm(false);
            refresh();
          }}
        />
      </FormModal>
    </div>
  );
}
