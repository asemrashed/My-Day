"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface CalEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  colorLabel: string;
}

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  status: string;
}

interface CalendarViewProps {
  initialEvents: CalEvent[];
  upcomingTasks: Task[];
}

const COLOR_OPTIONS = [
  { label: "blue", bg: "bg-primary", border: "border-primary", text: "text-primary" },
  { label: "indigo", bg: "bg-indigo-500", border: "border-indigo-400", text: "text-indigo-400" },
  { label: "purple", bg: "bg-purple-500", border: "border-purple-400", text: "text-purple-400" },
  { label: "rose", bg: "bg-rose-500", border: "border-rose-400", text: "text-rose-400" },
  { label: "amber", bg: "bg-amber-500", border: "border-amber-400", text: "text-amber-400" },
  { label: "cyan", bg: "bg-cyan-500", border: "border-cyan-400", text: "text-cyan-400" },
];

function getColorClass(label: string) {
  return COLOR_OPTIONS.find((c) => c.label === label) || COLOR_OPTIONS[0];
}

export default function CalendarView({ initialEvents, upcomingTasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newColor, setNewColor] = useState("blue");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = new Date(e.startAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const handleDayClick = (day: number) => {
    const clicked = new Date(year, month, day);
    const iso = clicked.toISOString().slice(0, 16);
    setNewStart(iso);
    setNewEnd(iso);
    setShowAddForm(true);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newStart || !newEnd) {
      toast.error("Fill in all required fields");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, startAt: newStart, endAt: newEnd, colorLabel: newColor }),
        });
        const data = await res.json();
        if (res.ok) {
          setEvents((prev) => [...prev, data.event]);
          toast.success("Event added!");
          setShowAddForm(false);
          setNewTitle("");
          setNewStart("");
          setNewEnd("");
          setNewColor("blue");
        } else {
          toast.error(data.error || "Failed to add event");
        }
      } catch {
        toast.error("Network error");
      }
    });
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        toast.success("Event removed");
      }
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* Calendar Panel */}
      <div className="xl:col-span-3 space-y-4">
        {/* Header controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="app-icon-button">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-foreground">{monthLabel}</h2>
            <button onClick={nextMonth} className="app-icon-button">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-muted p-0.5 rounded-xl border border-border text-xs font-semibold">
              {(["month", "week"] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${viewMode === v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddForm(true)}
              className="app-button-primary flex items-center gap-2 text-xs">
              <Plus className="h-4 w-4" /> Add Event
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="app-card overflow-hidden p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {/* Empty padding cells */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[90px] border-b border-r border-border bg-muted/30" />
            ))}

            {/* Day cells */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isTodayCell = isToday(day);

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[90px] border-b border-r border-border p-2 cursor-pointer group transition-colors hover:bg-muted/60 ${
                    isTodayCell ? "bg-primary/10" : ""
                  }`}
                >
                  <span className={`text-xs font-bold inline-flex items-center justify-center h-6 w-6 rounded-full transition-all ${
                    isTodayCell
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const colorClass = getColorClass(ev.colorLabel);
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate ${colorClass.bg} text-white cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
                          title={`${ev.title} (click to delete)`}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar: Add Event + Upcoming Tasks */}
      <div className="xl:col-span-1 space-y-6">
        {/* Add Event Form */}
        {showAddForm && (
          <div className="app-card p-5 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-card-foreground text-sm">New Event</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Event Title</label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Team sync"
                  className="app-input text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Start Time</label>
                <input type="datetime-local" required value={newStart} onChange={(e) => setNewStart(e.target.value)}
                  className="app-input text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">End Time</label>
                <input type="datetime-local" required value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                  className="app-input text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Color Label</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c.label} type="button" onClick={() => setNewColor(c.label)}
                      className={`h-6 w-6 rounded-full ${c.bg} transition-all active:scale-90 ${newColor === c.label ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" : ""}`}
                      title={c.label} />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={isPending}
                className="app-button-primary w-full py-2 text-xs flex items-center justify-center gap-2">
                {isPending ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Save Event"}
              </button>
            </form>
          </div>
        )}

        {/* Upcoming Tasks */}
        <div className="app-card p-5">
          <h3 className="font-bold text-card-foreground text-sm mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Upcoming Tasks
          </h3>
          {upcomingTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No upcoming tasks</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <div key={task.id} className={`p-3 rounded-xl border text-xs ${
                  task.status === "DONE"
                    ? "border-primary/30 bg-primary/10 opacity-60"
                    : "border-border bg-muted/60"
                }`}>
                  <p className={`font-semibold ${task.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className="text-muted-foreground mt-0.5">
                      {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                    task.priority === "HIGH" ? "bg-rose-950/30 text-rose-500" :
                    task.priority === "MEDIUM" ? "bg-amber-950/30 text-amber-500" : "bg-primary/10 text-primary"
                  }`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Color legend */}
        <div className="app-card p-5">
          <h3 className="font-bold text-card-foreground text-xs mb-3 uppercase tracking-wider">Color Legend</h3>
          <div className="space-y-2">
            {COLOR_OPTIONS.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${c.bg}`} />
                <span className="text-xs capitalize text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
