import {
  TEAM_COLORS,
  SPRINT_ROUNDS_2025,
  getFlag,
  type Driver,
  type Team,
  type Race,
  type RaceEntry,
  type SeasonData,
} from "../data/f1-constants";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "https://api.jolpi.ca/ergast/f1";
const YEAR = 2025;

// ─────────────────────────────────────────────────────────────────────────────
// RAW TYPES
// ─────────────────────────────────────────────────────────────────────────────

type JolpicaDriver = {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string;
};

type JolpicaConstructor = {
  constructorId: string;
  name: string;
};

type JolpicaResult = {
  position: string;
  positionText: string;
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
};

type JolpicaRaceSkeleton = {
  round: string;
  raceName: string;
  Circuit: { circuitName: string };
  date: string;
};

type JolpicaRacesResponse = {
  MRData: { RaceTable: { Races: JolpicaRaceSkeleton[] } };
};

type JolpicaResultsResponse = {
  MRData: { RaceTable: { Races: Array<{ Results: JolpicaResult[] }> } };
};

type JolpicaSprintResponse = {
  MRData: { RaceTable: { Races: Array<{ SprintResults: JolpicaResult[] }> } };
};

type JolpicaDriversResponse = {
  MRData: { DriverTable: { Drivers: JolpicaDriver[] } };
};

type JolpicaConstructorsResponse = {
  MRData: { ConstructorTable: { Constructors: JolpicaConstructor[] } };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jolpica ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

function isFinished(positionText: string): boolean {
  return !["R", "D", "E", "W", "N", "F"].includes(positionText);
}

function shortRaceName(raceName: string): string {
  return raceName.replace(" Grand Prix", "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH 1: Calendar + drivers + constructors (app startup — 3 requests)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCalendar(year = YEAR): Promise<SeasonData> {
  const [racesData, driversData, constructorsData] = await Promise.all([
    fetchJson<JolpicaRacesResponse>(`${BASE}/${year}/races/?limit=30`),
    fetchJson<JolpicaDriversResponse>(`${BASE}/${year}/drivers/?limit=30`),
    fetchJson<JolpicaConstructorsResponse>(`${BASE}/${year}/constructors/?limit=20`),
  ]);

  // Build teams
  const teams: Record<string, Team> = {};
  for (const c of constructorsData.MRData.ConstructorTable.Constructors) {
    teams[c.constructorId] = {
      id: c.constructorId,
      name: c.name,
      color: TEAM_COLORS[c.constructorId] ?? "#888888",
      driverIds: [],
    };
  }

  // Build race skeletons — no results yet
  const races: Race[] = racesData.MRData.RaceTable.Races.map((r) => ({
    id: parseInt(r.round, 10),
    name: r.raceName,
    shortName: shortRaceName(r.raceName),
    circuit: r.Circuit.circuitName,
    date: r.date,
    hasSprint: SPRINT_ROUNDS_2025.has(parseInt(r.round, 10)),
    results: [], // populated lazily on demand
  }));

  // Build drivers (no teamId yet — filled in as results are loaded)
  const drivers: Record<string, Driver> = {};
  for (const d of driversData.MRData.DriverTable.Drivers) {
    drivers[d.driverId] = {
      id: d.driverId,
      name: `${d.givenName} ${d.familyName}`,
      short: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
      teamId: "", // filled below from constructors + later from results
      flag: getFlag(d.nationality),
    };
  }

  return { drivers, teams, races };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH 2: Results for a single race (on demand — 1-2 requests)
// ─────────────────────────────────────────────────────────────────────────────

export type RaceResultPayload = {
  results: RaceEntry[];
  // driverId → constructorId — used to update driver.teamId in the store
  driverTeams: Record<string, string>;
};

export async function fetchRaceResults(
  round: number,
  hasSprint: boolean,
  year = YEAR
): Promise<RaceResultPayload> {
  const [resultsData, sprintData] = await Promise.all([
    fetchJson<JolpicaResultsResponse>(
      `${BASE}/${year}/${round}/results/?limit=25`
    ),
    hasSprint
      ? fetchJson<JolpicaSprintResponse>(
        `${BASE}/${year}/${round}/sprint/?limit=10`
      ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const driverTeams: Record<string, string> = {};

  const rawResults = resultsData.MRData.RaceTable.Races[0]?.Results ?? [];
  const rawSprint = sprintData?.MRData.RaceTable.Races[0]?.SprintResults ?? [];

  // Sprint position map
  const sprintPosMap = new Map(
    rawSprint.map((s) => [
      s.Driver.driverId,
      isFinished(s.positionText) ? parseInt(s.position, 10) : null,
    ])
  );

  const results: RaceEntry[] = rawResults.map((r) => {
    driverTeams[r.Driver.driverId] = r.Constructor.constructorId;
    return {
      driverId: r.Driver.driverId,
      position: isFinished(r.positionText) ? parseInt(r.position, 10) : null,
      sprintPosition: sprintPosMap.get(r.Driver.driverId) ?? null,
    };
  });

  // Also capture sprint-only drivers (shouldn't happen but safe)
  for (const s of rawSprint) {
    driverTeams[s.Driver.driverId] = s.Constructor.constructorId;
  }

  return { results, driverTeams };
}
