import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    /*
     * The 5s default is too tight for the typing-heavy interaction tests.
     * Building a jsdom per file is 40% of this suite's wall-clock, and under
     * Vitest 5's parallelism the slowest `userEvent.type` tests were landing
     * within a few hundred milliseconds of the limit — passing alone and
     * failing at random in a full run, which is the worst kind of red.
     *
     * A ceiling, not a licence: a genuinely hung test still fails, it just
     * takes 15s to say so.
     */
    testTimeout: 15_000,
    hookTimeout: 15_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
    /*
     * The Playwright specs live in e2e/ and match vitest's default `*.spec.ts`
     * pattern, but they need a browser and a running app. Letting vitest
     * collect them turns `pnpm test` red with an unhelpful message about
     * test.describe() being called in the wrong place. They are run by
     * `pnpm test:e2e`.
     */
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],

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
        // Any Next build output. Build artefacts in the coverage denominator
        // and ad-hoc verification builds use sibling `.next-*` directories,
        // and a build artifact left out of this list lands in the coverage
        // denominator and sinks the gate without a single test failing.
        ".next/**",
        ".next-*/**",
        "**/.next-*/**",
        "coverage/**",
        // Guard against a TailAdmin reference clone being checked out here
        // again. The design system was ported from it and the directory has
        // since been moved out of the repo, but while it was present it broke
        // tsc, ESLint, Prettier and this coverage run in turn — none of those
        // tools read .gitignore, so each needs its own entry. Four cheap lines
        // that prevent a genuinely confusing failure.
        "free-nextjs-admin-dashboard/**",
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
        "src/proxy.ts",
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
