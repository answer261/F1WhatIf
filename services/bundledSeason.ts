import bundled2025 from "../data/bundled-season-2025.json";
import bundled2026 from "../data/bundled-season-2026.json";
import type { CalendarData, RaceResultPayload } from "./seasonTypes";

export type BundledSeasonFile = {
  calendar: CalendarData;
  raceResultsByRound: Record<string, RaceResultPayload>;
};

export const BUNDLED_SEASON_YEARS = [2025, 2026] as const;
export type SeasonYear = (typeof BUNDLED_SEASON_YEARS)[number];

const bundledByYear: Record<SeasonYear, BundledSeasonFile> = {
  2025: bundled2025 as BundledSeasonFile,
  2026: bundled2026 as BundledSeasonFile,
};

export function isSeasonYear(value: number): value is SeasonYear {
  return (BUNDLED_SEASON_YEARS as readonly number[]).includes(value);
}

export function getBundledSeason(year: SeasonYear): BundledSeasonFile {
  return bundledByYear[year];
}

/** Numeric keys from JSON become strings; normalize for the store. */
export function getPreloadedRaceResultsMap(
  year: SeasonYear
): Record<number, RaceResultPayload> {
  const bundled = bundledByYear[year];
  const out: Record<number, RaceResultPayload> = {};
  for (const [k, v] of Object.entries(bundled.raceResultsByRound)) {
    out[Number(k)] = v;
  }
  return out;
}
