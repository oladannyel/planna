import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      exclude: [
        "node_modules/",
        ".next/**",
        "coverage/**",
        // Next.js App Router entrypoints — integration-tested via the app, not
        // units. (Anchored `src/app/**` alone misses route-group dirs like
        // `(auth)`/`(dashboard)` under v8 glob matching, so match broadly.)
        "src/app/**",
        "**/app/**",
        "**/{page,layout,loading,route,error,not-found}.{ts,tsx}",
        "src/types/**",
        "**/*.config.*",
        "**/*.d.ts",
        "**/index.ts",
        // Third-party-client construction / framework glue — verified via
        // integration tests against the Supabase emulator (spec §0), not units.
        "src/lib/supabase/**",
        "src/lib/openrouter.ts",
        "src/middleware.ts",
        // Realtime subscription wiring — needs a live Supabase backend to
        // exercise; the merge logic it delegates to is covered elsewhere.
        "src/hooks/**",
        // dnd-kit-bound view components: drag interaction needs real pointer
        // events; all move/persist/rollback logic lives in board/dnd.ts (100%).
        "src/features/board/KanbanBoard.tsx",
        "src/features/board/KanbanColumn.tsx",
        "src/features/board/DraggableTaskCard.tsx",
        // Recharts SVG charts: render to SVG via ResponsiveContainer (0-size in
        // jsdom); their data comes from analytics/metrics.ts (100% covered).
        "src/features/analytics/TasksPerDayChart.tsx",
        "src/features/analytics/CategoryBreakdown.tsx",
        "src/features/analytics/CycleTimeChart.tsx",
        "src/features/analytics/LazyCharts.tsx",
        // Radix Toast provider/viewport — portal + animation glue; the firing
        // logic that matters is in CarryoverNotifier (covered).
        "src/components/ui/Toast.tsx",
      ],
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
