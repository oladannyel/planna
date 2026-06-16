"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { rowToTask } from "@/features/tasks/mappers";
import type { Task } from "@/features/tasks/types";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function reduce(prev: Task[], payload: RealtimePostgresChangesPayload<TaskRow>): Task[] {
  if (payload.eventType === "DELETE") {
    const removedId = payload.old.id;
    return prev.filter((task) => task.id !== removedId);
  }
  const task = rowToTask(payload.new);
  return [task, ...prev.filter((existing) => existing.id !== task.id)];
}

/**
 * Local task state seeded from the server, kept live via a Supabase realtime
 * subscription on the `tasks` table. `setTasks` enables optimistic updates.
 */
export function useTasks(initialTasks: Task[]): {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
} {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-changes")
      .on<TaskRow>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => reduce(prev, payload));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { tasks, setTasks };
}
