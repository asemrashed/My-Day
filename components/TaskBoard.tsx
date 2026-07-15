"use client";

import { useState, useTransition, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { reorderTasks, createTask } from "@/app/actions/tasks";
import TaskCard from "./TaskCard";
import FormModal from "@/components/FormModal";
import { Plus, ListTodo, Filter } from "lucide-react";
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

interface TaskBoardProps {
  initialTasks: Task[];
}

const expenseCategories = ["Work", "Personal", "Learning", "Health", "Shopping", "Other"];

export default function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [timeFilter, setTimeFilter] = useState("all"); // all, today, week
  const [priorityFilter, setPriorityFilter] = useState("all"); // all, HIGH, MEDIUM, LOW
  const [statusFilter, setStatusFilter] = useState("all"); // all, PENDING, DONE

  // Task creation states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("Work");

  const resetAddForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("MEDIUM");
    setCategory("Work");
    setShowForm(false);
  };

  // Sync initial tasks
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Set up dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Avoid accidental drags when clicking checkboxes/actions
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Refresh data function
  const refreshTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag End handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Sync with database asynchronously
        const orderedIds = newItems.map((item) => item.id);
        reorderTasks(orderedIds).then((res) => {
          if (!res.success) {
            toast.error("Failed to save layout order");
            // revert or refresh
            refreshTasks();
          }
        });

        return newItems;
      });
    }
  };

  // Submit quick add task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error("Task title is required");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("dueDate", dueDate);
      formData.append("priority", priority);
      formData.append("category", category);

      const res = await createTask(formData);
      if (res.success) {
        toast.success("Task created!");
        resetAddForm();
        refreshTasks();
      } else {
        toast.error(res.error || "Failed to create task");
      }
    });
  };

  // Filter tasks based on settings
  const filteredTasks = tasks.filter((task) => {
    // 1. Time Filter
    if (timeFilter === "today") {
      if (!task.dueDate) return false;
      const today = new Date();
      const dueDate = new Date(task.dueDate);
      if (dueDate.toDateString() !== today.toDateString()) return false;
    } else if (timeFilter === "week") {
      if (!task.dueDate) return false;
      const today = new Date();
      const dueDate = new Date(task.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 7) return false;
    }

    // 2. Priority Filter
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;

    // 3. Status Filter
    if (statusFilter !== "all" && task.status !== statusFilter) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="app-button-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {/* Interactive Filters Panel */}
      <div className="app-panel flex flex-wrap items-center justify-between gap-4 p-4 text-xs font-semibold">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4 text-primary" />
          <span>Filters:</span>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          {/* Due dates */}
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1 rounded-md transition-all ${
                timeFilter === "all" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter("today")}
              className={`px-3 py-1 rounded-md transition-all ${
                timeFilter === "today" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeFilter("week")}
              className={`px-3 py-1 rounded-md transition-all ${
                timeFilter === "week" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Week
            </button>
          </div>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">All Priorities</option>
            <option value="HIGH">🔴 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🔵 Low</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">⏱ Pending</option>
            <option value="DONE">✅ Done</option>
          </select>
        </div>
      </div>

      {/* Task List container */}
      {filteredTasks.length === 0 ? (
        <div className="app-card p-12 text-center text-muted-foreground">
          <ListTodo className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
          <h4 className="font-bold text-muted-foreground text-lg">No Tasks Found</h4>
          <p className="text-xs text-muted-foreground mt-1">Try relaxing your filters or add a new task above!</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} onRefresh={refreshTasks} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FormModal open={showForm} onClose={resetAddForm} title="Plan a Task">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="app-input px-4 py-2.5 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className="app-input px-4 py-2.5"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="app-input px-4 py-2.5 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="app-input px-4 py-2.5 text-xs font-semibold"
              >
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="app-input px-4 py-2.5 text-xs font-semibold"
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="app-button-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add Task
              </>
            )}
          </button>
        </form>
      </FormModal>
    </div>
  );
}
