import { redirect } from "next/navigation";

import { MobileNav, Sidebar, SidebarProvider, TopBar } from "@/components/layout";
import { ToastProvider } from "@/components/ui";
import { CarryoverNotifier } from "@/features/daily/CarryoverNotifier";
import { countCarryovers } from "@/features/tasks/queries";
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

  // A count, not a fetch — see countCarryovers. This runs on every route.
  const carryoverResult = await countCarryovers();
  const carryoverCount = carryoverResult.ok ? carryoverResult.value : 0;

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
