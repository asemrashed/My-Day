"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Tags, Eye, Pencil, Check, X } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryItem,
} from "@/app/actions/categories";
import type { CategoryType } from "@/lib/categories";
import FormModal from "@/components/FormModal";
import toast from "react-hot-toast";

interface CategoryManagerProps {
  expenseItems: CategoryItem[];
  incomeItems: CategoryItem[];
  onChange: (next: { expenseItems: CategoryItem[]; incomeItems: CategoryItem[] }) => void;
  onRenamed?: (oldName: string, newName: string, type: CategoryType) => void;
}

function TypeToggle({
  value,
  onChange,
}: {
  value: CategoryType;
  onChange: (v: CategoryType) => void;
}) {
  return (
    <div className="flex bg-muted p-0.5 rounded-xl mb-4">
      {(["EXPENSE", "INCOME"] as CategoryType[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            value === t
              ? t === "INCOME"
                ? "bg-income text-white"
                : "bg-expense text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t === "INCOME" ? "Income" : "Expense"}
        </button>
      ))}
    </div>
  );
}

export default function CategoryManager({
  expenseItems,
  incomeItems,
  onChange,
  onRenamed,
}: CategoryManagerProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewTab, setViewTab] = useState<CategoryType>("EXPENSE");
  const [addTab, setAddTab] = useState<CategoryType>("EXPENSE");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isPending, startTransition] = useTransition();

  const viewItems = viewTab === "EXPENSE" ? expenseItems : incomeItems;

  const patchList = (
    type: CategoryType,
    updater: (list: CategoryItem[]) => CategoryItem[]
  ) => {
    if (type === "EXPENSE") {
      onChange({ expenseItems: updater(expenseItems), incomeItems });
    } else {
      onChange({ expenseItems, incomeItems: updater(incomeItems) });
    }
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }

    startTransition(async () => {
      const res = await createCategory(addTab, trimmed);
      if (res.success && res.category) {
        toast.success("Category added");
        setNewName("");
        patchList(addTab, (list) => [...list, res.category]);
        setAddOpen(false);
      } else {
        toast.error(res.error || "Failed to add category");
      }
    });
  };

  const startEdit = (item: CategoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = (item: CategoryItem) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }

    startTransition(async () => {
      const res = await updateCategory(item.id, trimmed);
      if (res.success && res.category) {
        toast.success("Category updated");
        patchList(viewTab, (list) =>
          list.map((c) => (c.id === item.id ? res.category : c))
        );
        if (res.oldName && res.oldName !== res.category.name) {
          onRenamed?.(res.oldName, res.category.name, viewTab);
        }
        cancelEdit();
      } else {
        toast.error(res.error || "Failed to update category");
      }
    });
  };

  const handleDelete = (item: CategoryItem) => {
    if (!confirm(`Delete category "${item.name}"? Existing transactions keep this label.`)) return;

    startTransition(async () => {
      const res = await deleteCategory(item.id);
      if (res.success) {
        toast.success("Category deleted");
        patchList(viewTab, (list) => list.filter((c) => c.id !== item.id));
        if (editingId === item.id) cancelEdit();
      } else {
        toast.error(res.error || "Failed to delete category");
      }
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 pr-1 border-r border-border/50 mr-1">
            <Tags className="h-3.5 w-3.5 text-primary" />
            Manage Category
          </span>
          <button
            type="button"
            onClick={() => {
              setViewTab("EXPENSE");
              cancelEdit();
              setViewOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-border hover:bg-muted transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            View Category
          </button>
          <button
            type="button"
            onClick={() => {
              setAddTab("EXPENSE");
              setNewName("");
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold app-button-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </div>
      </div>

      <FormModal
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          cancelEdit();
        }}
        title="View Categories"
        maxWidth="lg"
      >
        <TypeToggle value={viewTab} onChange={(t) => { setViewTab(t); cancelEdit(); }} />

        {viewItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">No categories yet</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {viewItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border/60 bg-muted/20"
              >
                {editingId === item.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="app-input text-xs flex-1"
                      maxLength={80}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit(item);
                        }
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(item)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                      {item.isDefault && (
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">
                          Default
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted"
                      title="Edit category"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </FormModal>

      <FormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Category"
        maxWidth="md"
      >
        <TypeToggle value={addTab} onChange={setAddTab} />

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              Category Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={addTab === "INCOME" ? "e.g. Consulting" : "e.g. Semester Fee"}
              className="app-input text-xs"
              maxLength={80}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="app-button-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
          >
            {isPending ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </>
            )}
          </button>
        </div>
      </FormModal>
    </>
  );
}
