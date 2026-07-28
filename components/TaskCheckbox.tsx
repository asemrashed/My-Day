"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleTaskStatus } from "@/app/actions/tasks";

interface TaskCheckboxProps {
  taskId: string;
  currentStatus: string;
}

export default function TaskCheckbox({ taskId, currentStatus }: TaskCheckboxProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const handleToggle = () => {
    const previous = status;
    const nextStatus = previous === "DONE" ? "PENDING" : "DONE";
    setStatus(nextStatus);
    startTransition(async () => {
      const result = await toggleTaskStatus(taskId, previous);
      if (!result.success) {
        setStatus(previous);
        return;
      }
      if (result.task) setStatus(result.task.status);
    });
  };

  return (
    <input
      type="checkbox"
      checked={status === "DONE"}
      onChange={handleToggle}
      disabled={isPending}
      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary accent-primary shrink-0 cursor-pointer disabled:opacity-50"
    />
  );
}
