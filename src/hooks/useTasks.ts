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
 *
 * The subscription is scoped to one workspace. Row Level Security already
 * prevents another workspace's rows reaching this client, so the filter is
 * not what makes this safe — it avoids asking the server to evaluate RLS for
 * events this client could never use, and keeps the channel name distinct
 * per workspace so two subscriptions cannot collide.
 */
export function useTasks(
  initialTasks: Task[],
  workspaceId?: string,
): {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
} {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  // Fall back to the seed data's workspace when none is passed, so existing
  // call sites keep working without threading the id through every component.
  const scopeId = workspaceId ?? initialTasks[0]?.workspaceId;

  useEffect(() => {
    if (!scopeId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-changes:${scopeId}`)
      .on<TaskRow>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${scopeId}`,
        },
        (payload) => {
          setTasks((prev) => reduce(prev, payload));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scopeId]);

  return { tasks, setTasks };
}
