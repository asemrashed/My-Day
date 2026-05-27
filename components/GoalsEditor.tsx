"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Link as LinkIcon, Image as ImageIcon, CheckSquare, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import toast from "react-hot-toast";

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

type Hyperlink = {
  id: string;
  title: string;
  url: string;
};

type GoalDescription = {
  text: string;
  checklist: ChecklistItem[];
  links: Hyperlink[];
  images: string[];
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  period: string; // DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM
  dueDate: string | null;
  progress: number;
  isCompleted: boolean;
  createdAt: string;
};

export default function GoalsEditor() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("WEEKLY");
  const [dueDate, setDueDate] = useState("");
  const [rawText, setRawText] = useState("");
  
  // Dynamic Checklist Items Builder
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Dynamic Hyperlinks Builder
  const [links, setLinks] = useState<Hyperlink[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Base64 Images list
  const [images, setImages] = useState<string[]>([]);

  // Expanded View states
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = () => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data) => {
        setGoals(Array.isArray(data) ? data : []);
      })
      .catch(() => setGoals([]));
  };

  // Helper to parse description safely
  const parseDescription = (descStr: string | null): GoalDescription => {
    if (!descStr) return { text: "", checklist: [], links: [], images: [] };
    try {
      const parsed = JSON.parse(descStr);
      if (parsed && typeof parsed === "object") {
        return {
          text: parsed.text || "",
          checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
          links: Array.isArray(parsed.links) ? parsed.links : [],
          images: Array.isArray(parsed.images) ? parsed.images : [],
        };
      }
    } catch (e) {
      // Return raw string as text if not valid JSON
      return { text: descStr, checklist: [], links: [], images: [] };
    }
    return { text: descStr, checklist: [], links: [], images: [] };
  };

  // Add checklist item
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([
      ...checklist,
      { id: crypto.randomUUID(), text: newChecklistItem.trim(), done: false },
    ]);
    setNewChecklistItem("");
  };

  // Remove checklist item
  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  // Add hyperlink
  const addLink = () => {
    if (!linkTitle.trim() || !linkUrl.trim()) {
      toast.error("Enter both link title and URL");
      return;
    }
    let formattedUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    setLinks([...links, { id: crypto.randomUUID(), title: linkTitle.trim(), url: formattedUrl }]);
    setLinkTitle("");
    setLinkUrl("");
  };

  // Remove hyperlink
  const removeLink = (id: string) => {
    setLinks(links.filter((l) => l.id !== id));
  };

  // Add Image Upload (Base64 conversion)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImages([...images, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove Image Attachment
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Reset form to pristine state
  const resetForm = () => {
    setTitle("");
    setPeriod("WEEKLY");
    setDueDate("");
    setRawText("");
    setChecklist([]);
    setLinks([]);
    setImages([]);
    setEditingGoalId(null);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a goal title");
      return;
    }

    const descriptionPayload: GoalDescription = {
      text: rawText.trim(),
      checklist,
      links,
      images,
    };

    // Calculate progress automatically based on checklist if items exist
    let calculatedProgress = 0;
    if (checklist.length > 0) {
      const completed = checklist.filter((item) => item.done).length;
      calculatedProgress = Math.round((completed / checklist.length) * 100);
    }

    const goalData = {
      id: editingGoalId || undefined,
      title: title.trim(),
      period,
      dueDate: dueDate || null,
      description: JSON.stringify(descriptionPayload),
      progress: calculatedProgress,
      isCompleted: calculatedProgress === 100,
    };

    try {
      const endpoint = "/api/goals";
      const method = editingGoalId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalData),
      });

      if (res.ok) {
        toast.success(editingGoalId ? "Goal updated!" : "Goal created!");
        resetForm();
        fetchGoals();
      } else {
        toast.error("Failed to save goal");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  // Edit Goal
  const startEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setTitle(goal.title);
    setPeriod(goal.period);
    setDueDate(goal.dueDate ? goal.dueDate.slice(0, 10) : "");
    
    const parsedDesc = parseDescription(goal.description);
    setRawText(parsedDesc.text);
    setChecklist(parsedDesc.checklist);
    setLinks(parsedDesc.links);
    setImages(parsedDesc.images);

    // Scroll to form on mobile
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete Goal
  const deleteGoal = async (id: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    try {
      const res = await fetch(`/api/goals?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Goal deleted");
        fetchGoals();
        if (expandedGoalId === id) setExpandedGoalId(null);
      } else {
        toast.error("Failed to delete goal");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  // Toggle checklist checkbox directly inside a goal card on the right column
  const toggleGoalChecklistItem = async (goal: Goal, itemId: string) => {
    const parsedDesc = parseDescription(goal.description);
    const updatedChecklist = parsedDesc.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    let calculatedProgress = 0;
    if (updatedChecklist.length > 0) {
      const completed = updatedChecklist.filter((item) => item.done).length;
      calculatedProgress = Math.round((completed / updatedChecklist.length) * 100);
    }

    const descriptionPayload: GoalDescription = {
      ...parsedDesc,
      checklist: updatedChecklist,
    };

    const updatePayload = {
      id: goal.id,
      description: JSON.stringify(descriptionPayload),
      progress: calculatedProgress,
      isCompleted: calculatedProgress === 100,
    };

    // Optimistic UI updates
    setGoals((prevGoals) =>
      prevGoals.map((g) =>
        g.id === goal.id
          ? {
              ...g,
              description: JSON.stringify(descriptionPayload),
              progress: calculatedProgress,
              isCompleted: calculatedProgress === 100,
            }
          : g
      )
    );

    try {
      await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });
    } catch (err) {
      toast.error("Failed to sync checklist changes");
      fetchGoals();
    }
  };

  // Sort/Group goals based on period
  const periods = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"];
  const periodLabelMap: Record<string, string> = {
    DAILY: "Daily Goals",
    WEEKLY: "Weekly Goals",
    MONTHLY: "Monthly Goals",
    YEARLY: "Yearly Goals",
    CUSTOM: "Custom Goals",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT COLUMN: Add / Edit form */}
      <div className="lg:col-span-5 app-card p-6 border border-border/60 bg-slate-900/40 relative">
        <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-foreground">
          {editingGoalId ? (
            <>
              <Edit2 className="h-4 w-4 text-primary" /> Edit Goal
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 text-primary" /> Create New Goal
            </>
          )}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Goal Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Learn full-stack development"
              className="app-input text-xs py-2.5"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="app-input text-xs py-2.5"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Target Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="app-input text-xs py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Description</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Describe what you want to achieve..."
              className="app-input text-xs h-20 py-2 resize-none"
            />
          </div>

          {/* Checklist Area */}
          <div className="border border-border/40 p-4 rounded-xl bg-slate-950/20">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
              <CheckSquare className="h-3.5 w-3.5" /> Checklist Tasks
            </label>
            <div className="flex gap-2 mb-3">
              <input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="e.g. Code for 2 hours"
                className="app-input text-xs py-1.5 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="app-button-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
              >
                Add
              </button>
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-2 bg-muted/30 border border-border/30 rounded-lg text-xs">
                    <span className="truncate text-foreground/80">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links Area */}
          <div className="border border-border/40 p-4 rounded-xl bg-slate-950/20">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
              <LinkIcon className="h-3.5 w-3.5" /> Hyperlinks
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title"
                className="app-input text-xs py-1.5"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="URL"
                className="app-input text-xs py-1.5"
              />
            </div>
            <button
              type="button"
              onClick={addLink}
              className="app-button-primary w-full py-1.5 text-xs flex items-center justify-center gap-1"
            >
              Add Hyperlink
            </button>

            {links.length > 0 && (
              <div className="space-y-1.5 mt-3 max-h-[140px] overflow-y-auto pr-1">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between gap-3 p-2 bg-muted/30 border border-border/30 rounded-lg text-xs">
                    <span className="truncate font-semibold text-primary">{link.title}</span>
                    <button
                      type="button"
                      onClick={() => removeLink(link.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image Attachments */}
          <div className="border border-border/40 p-4 rounded-xl bg-slate-950/20">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
              <ImageIcon className="h-3.5 w-3.5" /> Image Attachments
            </label>
            <div className="relative border border-dashed border-border/60 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-slate-900/20 transition-all cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-[10px] font-semibold text-muted-foreground">Upload Image</span>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square border border-border/60 rounded-lg overflow-hidden group">
                    <img src={img} alt="Attachment" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {editingGoalId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-[2] app-button-primary py-2.5 text-xs font-semibold"
            >
              {editingGoalId ? "Save Goal" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: categorized list */}
      <div className="lg:col-span-7 space-y-6">
        {goals.length === 0 ? (
          <div className="app-card py-16 text-center text-muted-foreground">
            <CheckSquare className="mx-auto h-12 w-12 opacity-15 mb-3" />
            <p className="text-sm font-semibold">No goals recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add goals on the left to map your progress!</p>
          </div>
        ) : (
          periods.map((cat) => {
            const catGoals = goals.filter((g) => g.period === cat);
            if (catGoals.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {periodLabelMap[cat]}
                </h3>

                <div className="space-y-3">
                  {catGoals.map((goal) => {
                    const parsedDesc = parseDescription(goal.description);
                    const isExpanded = expandedGoalId === goal.id;

                    return (
                      <div
                        key={goal.id}
                        className="app-card border border-border/40 hover:border-border/80 transition-all p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <h4 className={`font-bold text-sm truncate ${goal.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {goal.title}
                            </h4>
                            
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              {goal.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due {new Date(goal.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              <span>Progress: {goal.progress}%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => startEditGoal(goal)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted"
                              title="Edit goal"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete goal"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Progress slider bar */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border mt-3">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border/40 space-y-4 animate-in fade-in duration-200">
                            {parsedDesc.text && (
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                {parsedDesc.text}
                              </div>
                            )}

                            {/* Checklist toggles */}
                            {parsedDesc.checklist.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Checklist Items</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {parsedDesc.checklist.map((item) => (
                                    <label
                                      key={item.id}
                                      className="flex items-center gap-2 p-2 bg-muted/40 border border-border/30 rounded-xl cursor-pointer hover:bg-muted transition-all text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={item.done}
                                        onChange={() => toggleGoalChecklistItem(goal, item.id)}
                                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                                      />
                                      <span className={`truncate ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                        {item.text}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Attached Hyperlinks */}
                            {parsedDesc.links.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Links & Resources</span>
                                <div className="flex flex-wrap gap-2">
                                  {parsedDesc.links.map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
                                    >
                                      <LinkIcon className="h-3 w-3" />
                                      {link.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Embedded Image Galleries */}
                            {parsedDesc.images.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Attached Screens</span>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {parsedDesc.images.map((img, i) => (
                                    <a
                                      key={i}
                                      href={img}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative aspect-square rounded-xl border border-border/40 overflow-hidden hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer block"
                                    >
                                      <img src={img} alt="Attachment" className="h-full w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
