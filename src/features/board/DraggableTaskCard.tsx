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

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none transition-shadow",
        isDragging
          ? // Lift the card while dragging rather than fading it out, so the
            // thing under the cursor still reads as the card being moved.
            "rotate-1 cursor-grabbing opacity-90 shadow-theme-lg"
          : "cursor-grab",
      )}
      {...listeners}
      {...attributes}
    >
      <TaskCard task={task} />
    </div>
  );
}
