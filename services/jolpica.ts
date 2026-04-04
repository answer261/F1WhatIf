
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
    fetchJson<JolpicaDriversResponse>(`${BASE}/${year}/drivers/?limit=30`),
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
    drivers[d.driverId] = {
      id: d.driverId,
      name: `${d.givenName} ${d.familyName}`,
      short: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
      teamId,
      flag: getFlag(d.nationality),
    };
    if (teamId && teams[teamId] && !teams[teamId].driverIds.includes(d.driverId)) {
      teams[teamId].driverIds.push(d.driverId);
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

  return { results, driverTeams };
}