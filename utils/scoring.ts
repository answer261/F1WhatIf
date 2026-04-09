import {
  getRacePoints,
  getSprintPoints,
  type Driver,
  type RaceEntry,
  type Race,
} from "../data/f1-constants";
import type {
  ApiDriverStanding,
  ApiConstructorStanding,
} from "../services/jolpica";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DriverStanding = {
  position: number;
  driverId: string;
  points: number;
  wins: number;
  teamId: string;
};

export type ConstructorStanding = {
  position: number;
  teamId: string;
  points: number;
  wins: number;
};

export type RaceOverrides = Record<number, RaceEntry[]>;

// ─────────────────────────────────────────────────────────────────────────────
// DELTA-BASED RECALCULATION
//
// Strategy: start from the official API standings, then for each overridden
// race compute the points difference between the original and modified result
// and apply it as a delta. This means we never need all 24 races loaded.
// ─────────────────────────────────────────────────────────────────────────────

export function applyOverridesToStandings(
  apiDriverStandings: ApiDriverStanding[],
  apiConstructorStandings: ApiConstructorStanding[],
  overrides: RaceOverrides,
  races: Race[], // only needs results for overridden races (already loaded)
  driverTeamMap: Record<string, string>, // driverId → teamId (from loaded results)
  driversById: Record<string, Driver>
): {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} {
  // Start with a mutable copy of API standings
  const driverPoints = new Map<string, number>(
    apiDriverStandings.map((s) => [s.driverId, s.points])
  );
  const driverWins = new Map<string, number>(
    apiDriverStandings.map((s) => [s.driverId, s.wins])
  );
  const driverTeamId = new Map<string, string>(
    apiDriverStandings.map((s) => [s.driverId, s.teamId])
  );

  const constructorPoints = new Map<string, number>(
    apiConstructorStandings.map((s) => [s.teamId, s.points])
  );
  const constructorWins = new Map<string, number>(
    apiConstructorStandings.map((s) => [s.teamId, s.wins])
  );

  // Also include any drivers from driverTeamMap not in API standings
  // (edge case: new drivers mid-season)
  for (const [driverId, teamId] of Object.entries(driverTeamMap)) {
    if (!driverTeamId.has(driverId)) {
      driverTeamId.set(driverId, teamId);
      driverPoints.set(driverId, 0);
      driverWins.set(driverId, 0);
    }
  }

  for (const [raceId, newResults] of Object.entries(overrides)) {
    const race = races.find((r) => r.id === parseInt(raceId, 10));
    if (!race) continue;

    const originalResults = race.results;
    const hasSprint = race.hasSprint;

    // Build original points map for this race
    const originalPointsMap = buildRacePointsMap(originalResults, hasSprint);

    // Build new points map for this race
    const newPointsMap = buildRacePointsMap(newResults, hasSprint);

    // Collect all driverIds across both result sets
    const allDriverIds = new Set([
      ...originalPointsMap.keys(),
      ...newPointsMap.keys(),
    ]);

    for (const driverId of allDriverIds) {
      const orig = originalPointsMap.get(driverId) ?? { points: 0, wins: 0 };
      const next = newPointsMap.get(driverId) ?? { points: 0, wins: 0 };

      const pointsDelta = next.points - orig.points;
      const winsDelta = next.wins - orig.wins;

      if (pointsDelta === 0 && winsDelta === 0) continue;

      // Apply delta to driver
      driverPoints.set(driverId, (driverPoints.get(driverId) ?? 0) + pointsDelta);
      driverWins.set(driverId, (driverWins.get(driverId) ?? 0) + winsDelta);

      // Apply delta to constructor (API standings may omit Constructors[]; season drivers / result patches often have teamId)
      const teamId =
        driverTeamId.get(driverId) ||
        driverTeamMap[driverId] ||
        driversById[driverId]?.teamId ||
        "";
      if (teamId) {
        constructorPoints.set(teamId, (constructorPoints.get(teamId) ?? 0) + pointsDelta);
        constructorWins.set(teamId, (constructorWins.get(teamId) ?? 0) + winsDelta);
      }
    }
  }

  // Sort and assign positions
  const drivers: DriverStanding[] = Array.from(driverPoints.entries())
    .map(([driverId, points]) => ({
      driverId,
      points,
      wins: driverWins.get(driverId) ?? 0,
      teamId: driverTeamId.get(driverId) ?? "",
      position: 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((s, i) => ({ ...s, position: i + 1 }));

  const constructors: ConstructorStanding[] = Array.from(constructorPoints.entries())
    .map(([teamId, points]) => ({
      teamId,
      points,
      wins: constructorWins.get(teamId) ?? 0,
      position: 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((s, i) => ({ ...s, position: i + 1 }));

  return { drivers, constructors };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type DriverRacePoints = { points: number; wins: number };

/** Exported for unit tests — maps finishing positions to points + sprint + win credit for one race. */
export function buildRacePointsMap(
  results: RaceEntry[],
  hasSprint: boolean
): Map<string, DriverRacePoints> {
  const map = new Map<string, DriverRacePoints>();

  for (const entry of results) {
    const racePoints = getRacePoints(entry.position);
    const sprintPoints = hasSprint ? getSprintPoints(entry.sprintPosition) : 0;
    const wins = entry.position === 1 ? 1 : 0;

    map.set(entry.driverId, {
      points: racePoints + sprintPoints,
      wins,
    });
  }

  return map;
}
