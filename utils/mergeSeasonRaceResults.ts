import type { Driver, RaceEntry, SeasonData } from "../data/f1-constants";

/** Merge one round’s results into season data (pure; safe for concurrent callers to compose via functional store updates). */
export function mergeRacePayloadIntoSeason(
  seasonData: SeasonData,
  raceId: number,
  results: RaceEntry[],
  driversPatch: Record<string, Driver>
): SeasonData {
  const updatedRaces = seasonData.races.map((r) =>
    r.id === raceId ? { ...r, results } : r
  );
  const mergedDrivers =
    Object.keys(driversPatch).length > 0
      ? { ...seasonData.drivers, ...driversPatch }
      : seasonData.drivers;
  return { ...seasonData, races: updatedRaces, drivers: mergedDrivers };
}
