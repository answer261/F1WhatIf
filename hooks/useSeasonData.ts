import { useMemo } from "react";
import type { CalendarData } from "../services/seasonTypes";
import { getBundledSeason, type SeasonYear } from "../services/bundledSeason";

// ─────────────────────────────────────────────────────────────────────────────
// STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type SeasonDataState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "success"; data: CalendarData; fromCache: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — bundled JSON per year (no network).
// Regenerate: npm run bundle-season -- --year=YYYY
// ─────────────────────────────────────────────────────────────────────────────

export function useSeasonData(year: SeasonYear): SeasonDataState {
  return useMemo(
    () => ({
      status: "success" as const,
      data: getBundledSeason(year).calendar,
      fromCache: false,
    }),
    [year]
  );
}
