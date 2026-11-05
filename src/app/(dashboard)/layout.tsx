import { redirect } from "next/navigation";

import { MobileNav, Sidebar, SidebarProvider, TopBar } from "@/components/layout";
import { ToastProvider } from "@/components/ui";
import { CarryoverNotifier } from "@/features/daily/CarryoverNotifier";
import { detectCarryovers } from "@/features/tasks/carryover";
import { getTasks } from "@/features/tasks/queries";
import { ensureWorkspace } from "@/features/workspace";
import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspace = await ensureWorkspace();
  if (!workspace.ok) {
    logger.error("Failed to ensure workspace in dashboard layout", { error: workspace.error });
  }

  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("owner_id", user.id)
    .maybeSingle();

  const workspaceName = ws?.name ?? "Your workspace";

  const tasksResult = await getTasks();
  const carryoverCount = tasksResult.ok ? detectCarryovers(tasksResult.value).length : 0;

  return (
    <ToastProvider>
      <SidebarProvider>
        <div className="flex min-h-dvh bg-canvas">
          <Sidebar workspaceName={workspaceName} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar email={user.email ?? ""} />
            <main className="flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-8">{children}</main>
            <MobileNav />
          </div>
        </div>
      </SidebarProvider>
      <CarryoverNotifier count={carryoverCount} />
    </ToastProvider>
  );
}
