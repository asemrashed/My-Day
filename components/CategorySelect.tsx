"use client";

import { useState, useTransition } from "react";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { createCategory, deleteCategoryByName, type CategoryItem } from "@/app/actions/categories";
import type { CategoryType } from "@/lib/categories";
import toast from "react-hot-toast";

interface CategorySelectProps {
  type: CategoryType;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCategoryAdded?: (name: string, type: CategoryType, item?: CategoryItem) => void;
  onCategoryDeleted?: (name: string, type: CategoryType) => void;
  label?: string;
  className?: string;
}

export default function CategorySelect({
  type,
  value,
  options,
  onChange,
  onCategoryAdded,
  onCategoryDeleted,
  label = "Category",
  className = "",
}: CategorySelectProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }

    startTransition(async () => {
      const res = await createCategory(type, trimmed);
      if (res.success && res.category) {
        toast.success("Category added");
        onCategoryAdded?.(res.category.name, type, res.category);
        onChange(res.category.name);
        setNewName("");
        setShowAdd(false);
      } else {
        toast.error(res.error || "Failed to add category");
      }
    });
  };

  const handleDeleteSelected = () => {
    if (!value) return;
    if (!confirm(`Delete category "${value}"?`)) return;

    startTransition(async () => {
      const res = await deleteCategoryByName(type, value);
      if (res.success) {
        toast.success("Category deleted");
        onCategoryDeleted?.(value, type);
        const remaining = options.filter((o) => o !== value);
        onChange(remaining[0] || "");
      } else {
        toast.error(res.error || "Failed to delete category");
      }
    });
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-[10px] uppercase font-bold text-muted-foreground block">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {!showAdd && value && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive hover:text-destructive/80"
              title="Delete selected category"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
          >
            {showAdd ? (
              <>
                <X className="h-3 w-3" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" /> Add
              </>
            )}
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={type === "INCOME" ? "e.g. Consulting" : "e.g. Gym"}
            className="app-input text-xs flex-1"
            maxLength={80}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="app-button-primary px-3 py-2 text-xs shrink-0 flex items-center gap-1"
          >
            {isPending ? (
              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      ) : (
        <select
          value={options.includes(value) ? value : options[0] || ""}
          onChange={(e) => onChange(e.target.value)}
          className="app-input text-xs"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
