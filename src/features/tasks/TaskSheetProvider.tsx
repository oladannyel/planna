"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { TaskDetailSheet } from "./TaskDetailSheet";
import type { Task } from "./types";

interface TaskSheetContextValue {
  open: (task: Task) => void;
}

const TaskSheetContext = createContext<TaskSheetContextValue>({
  open: () => {},
});

/** Open the task detail/edit sheet for a given task. No-ops outside a provider. */
export function useTaskSheet(): TaskSheetContextValue {
  return useContext(TaskSheetContext);
}

/**
 * Wraps a list of task cards and renders a single shared detail/edit sheet.
 * Any `TaskCard` rendered within can call `useTaskSheet().open(task)`.
 */
export function TaskSheetProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Task | null>(null);

  return (
    <TaskSheetContext.Provider value={{ open: setSelected }}>
      {children}
      {selected ? <TaskDetailSheet task={selected} onClose={() => setSelected(null)} /> : null}
    </TaskSheetContext.Provider>
  );
}
