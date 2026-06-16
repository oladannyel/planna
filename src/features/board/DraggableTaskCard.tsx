"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { TaskCard } from "@/features/tasks/TaskCard";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

export function DraggableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("cursor-grab touch-none", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      <TaskCard task={task} />
    </div>
  );
}
