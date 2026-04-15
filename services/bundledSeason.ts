import bundled from "../data/bundled-season-2025.json";
import type { CalendarData, RaceResultPayload } from "./seasonTypes";

export type BundledSeason2025File = {
  calendar: CalendarData;
  raceResultsByRound: Record<string, RaceResultPayload>;
};

export const bundledSeason2025 = bundled as BundledSeason2025File;

/** Numeric keys from JSON become strings; normalize for the store. */
export const preloadedRaceResultsMap: Record<number, RaceResultPayload> = (() => {
  const out: Record<number, RaceResultPayload> = {};
  for (const [k, v] of Object.entries(bundledSeason2025.raceResultsByRound)) {
    out[Number(k)] = v;
  }
  return out;
})();
