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
 * Two things keep this in step with the server, and both are needed:
 *
 * 1. `initialTasks` is re-adopted whenever the server sends a new list. Every
 *    task mutation calls `revalidatePath`, so a fresh prop identity means the
 *    server has re-rendered with authoritative data. Seeding `useState` once
 *    and never looking again is why newly created tasks did not appear until
 *    a manual reload — the RSC payload updated, the component ignored it.
 *    This is React's documented "adjust state during render" pattern, which
 *    re-renders before paint rather than flashing stale data like an effect.
 *
 * 2. The realtime subscription, for changes this browser did not make.
 *
 * The subscription is scoped to one workspace. Row Level Security already
 * prevents another workspace's rows reaching this client, so the filter is
 * not what makes this safe — it avoids asking the server to evaluate RLS for
 * events this client could never use, and keeps the channel name distinct
 * per workspace so two subscriptions cannot collide.
 *
 * Pass `workspaceId` explicitly. Inferring it from `initialTasks[0]` cannot
 * work on an empty board: with no rows there is no id, so no subscription was
 * ever opened, and the first task created in a fresh workspace — exactly when
 * a user is most likely to be watching — never arrived.
 */
export function useTasks(
  initialTasks: Task[],
  workspaceId?: string,
): {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
} {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [seed, setSeed] = useState<Task[]>(initialTasks);

  if (seed !== initialTasks) {
    setSeed(initialTasks);
    setTasks(initialTasks);
  }

  // Fall back to the seed data's workspace when none is passed, so call sites
  // that have not been updated keep the behaviour they had.
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
