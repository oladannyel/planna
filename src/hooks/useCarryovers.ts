"use client";

import { useMemo } from "react";

import { detectCarryovers } from "@/features/tasks/carryover";
import type { Task } from "@/features/tasks/types";

/** Memoized carryover subset of a task list, for client views. */
export function useCarryovers(tasks: Task[]): Task[] {
  return useMemo(() => detectCarryovers(tasks), [tasks]);
}
