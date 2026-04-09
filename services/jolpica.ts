
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
  code?: string;
  givenName?: string;
  familyName?: string;
  nationality?: string;
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

type JolpicaDriverStanding = {
  position: string;
  points: string;
  wins: string;
  Driver: JolpicaDriver;
  Constructors: JolpicaConstructor[];
};

type JolpicaConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  Constructor: JolpicaConstructor;
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

type JolpicaDriverStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{ DriverStandings: JolpicaDriverStanding[] }>;
    };
  };
};

type JolpicaConstructorStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{ ConstructorStandings: JolpicaConstructorStanding[] }>;
    };
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED STANDING TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ApiDriverStanding = {
  position: number;
  driverId: string;
  points: number;
  wins: number;
  teamId: string;
};

export type ApiConstructorStanding = {
  position: number;
  teamId: string;
  points: number;
  wins: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jolpica ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/** Build app Driver from API row (handles missing code / nationality on reserve entries). */
function driverFromJolpica(d: JolpicaDriver, teamId: string): Driver {
  const given = d.givenName?.trim() ?? "";
  const family = d.familyName?.trim() ?? "";
  const name =
    given && family
      ? `${given} ${family}`
      : given || family || d.driverId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const code = d.code?.trim();
  const asciiFamily = family
    ? family.normalize("NFD").replace(/\p{M}/gu, "")
    : "";
  const short =
    code ||
    (asciiFamily.length >= 3 ? asciiFamily.slice(0, 3).toUpperCase() : "") ||
    d.driverId.replace(/^.*_/, "").slice(0, 3).toUpperCase() ||
    "???";

  return {
    id: d.driverId,
    name,
    short,
    teamId,
    flag: d.nationality ? getFlag(d.nationality) : "🏁",
  };
}

function isFinished(positionText: string): boolean {
  return !["R", "D", "E", "W", "N", "F"].includes(positionText);
}

function shortRaceName(raceName: string): string {
  return raceName.replace(" Grand Prix", "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH 1: Calendar + drivers + constructors + standings (app startup)
// ─────────────────────────────────────────────────────────────────────────────

export type CalendarData = {
  seasonData: SeasonData;
  driverStandings: ApiDriverStanding[];
  constructorStandings: ApiConstructorStanding[];
};

export async function fetchCalendar(year = YEAR): Promise<CalendarData> {
  const [
    racesData,
    driversData,
    constructorsData,
    driverStandingsData,
    constructorStandingsData,
  ] = await Promise.all([
    fetchJson<JolpicaRacesResponse>(`${BASE}/${year}/races/?limit=30`),
    // Season lists >30 drivers (reserves / test drivers); a low limit drops race regulars from the map.
    fetchJson<JolpicaDriversResponse>(`${BASE}/${year}/drivers/?limit=100`),
    fetchJson<JolpicaConstructorsResponse>(`${BASE}/${year}/constructors/?limit=20`),
    fetchJson<JolpicaDriverStandingsResponse>(`${BASE}/${year}/driverstandings/`),
    fetchJson<JolpicaConstructorStandingsResponse>(`${BASE}/${year}/constructorstandings/`),
  ]);

  // ── Teams ────────────────────────────────────────────────────────────────
  const teams: Record<string, Team> = {};
  for (const c of constructorsData.MRData.ConstructorTable.Constructors) {
    teams[c.constructorId] = {
      id: c.constructorId,
      name: c.name,
      color: TEAM_COLORS[c.constructorId] ?? "#888888",
      driverIds: [],
    };
  }

  // ── Race skeletons ────────────────────────────────────────────────────────
  const races: Race[] = racesData.MRData.RaceTable.Races.map((r) => ({
    id: parseInt(r.round, 10),
    name: r.raceName,
    shortName: shortRaceName(r.raceName),
    circuit: r.Circuit.circuitName,
    date: r.date,
    hasSprint: SPRINT_ROUNDS_2025.has(parseInt(r.round, 10)),
    results: [],
  }));

  // ── Parse standings (safe against empty StandingsLists) ──────────────────
  const rawDriverStandings: JolpicaDriverStanding[] =
    driverStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]
      ?.DriverStandings ?? [];

  const rawConstructorStandings: JolpicaConstructorStanding[] =
    constructorStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]
      ?.ConstructorStandings ?? [];

  if (rawDriverStandings.length === 0) {
    console.warn("Jolpica returned empty driver standings");
  }

  const driverStandings: ApiDriverStanding[] = rawDriverStandings.map((s) => ({
    position: parseInt(s.position, 10),
    driverId: s.Driver.driverId,
    points: parseFloat(s.points),
    wins: parseInt(s.wins, 10),
    teamId: s.Constructors[0]?.constructorId ?? "",
  }));

  const constructorStandings: ApiConstructorStanding[] = rawConstructorStandings.map((s) => ({
    position: parseInt(s.position, 10),
    teamId: s.Constructor.constructorId,
    points: parseFloat(s.points),
    wins: parseInt(s.wins, 10),
  }));

  // ── Drivers ───────────────────────────────────────────────────────────────
  // Build driverId → teamId from standings (most reliable) or fall back to constructors
  const driverTeamMap = new Map<string, string>();
  for (const s of rawDriverStandings) {
    const teamId = s.Constructors[0]?.constructorId ?? "";
    driverTeamMap.set(s.Driver.driverId, teamId);
  }

  const drivers: Record<string, Driver> = {};
  for (const d of driversData.MRData.DriverTable.Drivers) {
    const teamId = driverTeamMap.get(d.driverId) ?? "";
    drivers[d.driverId] = driverFromJolpica(d, teamId);
    if (teamId && teams[teamId] && !teams[teamId].driverIds.includes(d.driverId)) {
      teams[teamId].driverIds.push(d.driverId);
    }
  }

  // Standings always reference full-time drivers; fill gaps if the drivers feed is truncated or out of sync.
  for (const s of rawDriverStandings) {
    const id = s.Driver.driverId;
    if (drivers[id]) continue;
    const teamId = s.Constructors[0]?.constructorId ?? "";
    drivers[id] = driverFromJolpica(s.Driver, teamId);
    if (teamId && teams[teamId] && !teams[teamId].driverIds.includes(id)) {
      teams[teamId].driverIds.push(id);
    }
  }

  return {
    seasonData: { drivers, teams, races },
    driverStandings,
    constructorStandings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH 2: Results for a single race (on demand)
// ─────────────────────────────────────────────────────────────────────────────

export type RaceResultPayload = {
  results: RaceEntry[];
  driverTeams: Record<string, string>;
  /** Drivers seen in this race but possibly missing from the season driver list (substitutes, etc.). */
  driversPatch: Record<string, Driver>;
};

export async function fetchRaceResults(
  round: number,
  hasSprint: boolean,
  year = YEAR
): Promise<RaceResultPayload> {
  const [resultsData, sprintData] = await Promise.all([
    fetchJson<JolpicaResultsResponse>(`${BASE}/${year}/${round}/results/?limit=25`),
    hasSprint
      ? fetchJson<JolpicaSprintResponse>(
        `${BASE}/${year}/${round}/sprint/?limit=10`
      ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const driverTeams: Record<string, string> = {};
  const rawResults = resultsData.MRData.RaceTable.Races[0]?.Results ?? [];
  const rawSprint = sprintData?.MRData.RaceTable.Races[0]?.SprintResults ?? [];

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

  for (const s of rawSprint) {
    driverTeams[s.Driver.driverId] = s.Constructor.constructorId;
  }

  const driversPatch: Record<string, Driver> = {};
  const addFromResult = (driver: JolpicaDriver, constructorId: string) => {
    const id = driver.driverId;
    if (driversPatch[id]) return;
    driversPatch[id] = driverFromJolpica(driver, constructorId);
  };
  for (const r of rawResults) {
    addFromResult(r.Driver, r.Constructor.constructorId);
  }
  for (const s of rawSprint) {
    addFromResult(s.Driver, s.Constructor.constructorId);
  }

  return { results, driverTeams, driversPatch };
}