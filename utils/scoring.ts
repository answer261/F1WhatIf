import {
  getRacePoints,
  getSprintPoints,
  type SeasonData,
  type RaceEntry,
} from "../data/f1-constants";

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
// CORE
// ─────────────────────────────────────────────────────────────────────────────

export function calculateStandings(
  seasonData: SeasonData | null | undefined,
  overrides: RaceOverrides = {}
): {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} {
  const drivers = seasonData?.drivers ?? {};
  const teams = seasonData?.teams ?? {};
  const races = seasonData?.races ?? [];

  const driverPoints = new Map<string, number>();
  const driverWins = new Map<string, number>();
  const constructorPoints = new Map<string, number>();
  const constructorWins = new Map<string, number>();

  // Initialise
  for (const id of Object.keys(drivers)) {
    driverPoints.set(id, 0);
    driverWins.set(id, 0);
  }
  for (const id of Object.keys(teams)) {
    constructorPoints.set(id, 0);
    constructorWins.set(id, 0);
  }

  for (const race of races) {
    const results: RaceEntry[] = overrides[race.id] ?? race.results;

    for (const entry of results) {
      const { driverId, position, sprintPosition } = entry;
      const driver = drivers[driverId];
      if (!driver) continue;

      const teamId = driver.teamId;

      // Race points
      const rp = getRacePoints(position);
      driverPoints.set(driverId, (driverPoints.get(driverId) ?? 0) + rp);
      constructorPoints.set(teamId, (constructorPoints.get(teamId) ?? 0) + rp);

      // Sprint points
      if (race.hasSprint && sprintPosition !== undefined) {
        const sp = getSprintPoints(sprintPosition);
        driverPoints.set(driverId, (driverPoints.get(driverId) ?? 0) + sp);
        constructorPoints.set(teamId, (constructorPoints.get(teamId) ?? 0) + sp);
      }

      // Wins
      if (position === 1) {
        driverWins.set(driverId, (driverWins.get(driverId) ?? 0) + 1);
        constructorWins.set(teamId, (constructorWins.get(teamId) ?? 0) + 1);
      }
    }
  }

  const driverStandings: DriverStanding[] = Object.keys(drivers).flatMap(
    (driverId) => {
      const driver = drivers[driverId];
      if (!driver) return [];
      return [
        {
          driverId,
          points: driverPoints.get(driverId) ?? 0,
          wins: driverWins.get(driverId) ?? 0,
          teamId: driver.teamId,
          position: 0,
        },
      ];
    }
  )
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));

  const constructorStandings: ConstructorStanding[] = Object.keys(teams)
    .map((teamId) => ({
      teamId,
      points: constructorPoints.get(teamId) ?? 0,
      wins: constructorWins.get(teamId) ?? 0,
      position: 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));

  return { drivers: driverStandings, constructors: constructorStandings };
}
