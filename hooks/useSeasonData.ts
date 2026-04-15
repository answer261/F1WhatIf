import { useMemo } from "react";
import type { CalendarData } from "../services/seasonTypes";
import { bundledSeason2025 } from "../services/bundledSeason";

// ─────────────────────────────────────────────────────────────────────────────
// STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type SeasonDataState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "success"; data: CalendarData; fromCache: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — 2025 season is shipped in data/bundled-season-2025.json (no network).
// Regenerate JSON: npm run bundle-season — see scripts/fetch-bundled-season.ts.
// ─────────────────────────────────────────────────────────────────────────────

export function useSeasonData(): SeasonDataState {
  return useMemo(
    () => ({
      status: "success" as const,
      data: bundledSeason2025.calendar,
      fromCache: false,
    }),
    []
  );
}
