"use client";

import { useTransition } from "react";
import { toggleTaskStatus } from "@/app/actions/tasks";

interface TaskCheckboxProps {
  taskId: string;
  currentStatus: string;
}

export default function TaskCheckbox({ taskId, currentStatus }: TaskCheckboxProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTaskStatus(taskId, currentStatus);
    });
  };

  return (
    <input
      type="checkbox"
      checked={currentStatus === "DONE"}
      onChange={handleToggle}
      disabled={isPending}
      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary accent-primary shrink-0 cursor-pointer disabled:opacity-50"
    />
  );
}
