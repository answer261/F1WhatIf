/**
 * Dev-only helpers for `fetch-bundled-season.ts` to rebuild bundled JSON.
 * Not imported by the app runtime.
 */
import {
  TEAM_COLORS,
  type Driver,
  type Team,
  type Race,
  type RaceEntry,
} from "../data/f1-constants";
import { driverFromRawRow, type RawDriverRow } from "../services/driverDisplay";
import type {
  BaselineConstructorStanding,
  BaselineDriverStanding,
  CalendarData,
  RaceResultPayload,
} from "../services/seasonTypes";

const DEFAULT_YEAR = 2025;
const FETCH_TIMEOUT_MS = 25_000;

function parseIntField(s: string | undefined, fallback = 0): number {
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatField(s: string | undefined, fallback = 0): number {
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : fallback;
}

type RawConstructor = {
  constructorId: string;
  name: string;
};

type RawResult = {
  position: string;
  positionText: string;
  Driver: RawDriverRow;
  Constructor: RawConstructor;
};

type RawRaceSkeleton = {
  round: string;
  raceName: string;
  Circuit: { circuitName: string };
  date: string;
};

type RawDriverStanding = {
  position: string;
  points: string;
  wins: string;
  Driver: RawDriverRow;
  Constructors: RawConstructor[];
};

type RawConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  Constructor: RawConstructor;
};

type RawRacesResponse = {
  MRData: { RaceTable: { Races: RawRaceSkeleton[] } };
};

type RawResultsResponse = {
  MRData: { RaceTable: { Races: Array<{ Results: RawResult[] }> } };
};

type RawSprintResponse = {
  MRData: { RaceTable: { Races: Array<{ SprintResults: RawResult[] }> } };
};

type RawSprintScheduleResponse = {
  MRData: { RaceTable: { Races: Array<{ round: string }> } };
};

type RawDriversResponse = {
  MRData: { DriverTable: { Drivers: RawDriverRow[] } };
};

type RawConstructorsResponse = {
  MRData: { ConstructorTable: { Constructors: RawConstructor[] } };
};

type RawDriverStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{ DriverStandings: RawDriverStanding[] }>;
    };
  };
};

type RawConstructorStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{ ConstructorStandings: RawConstructorStanding[] }>;
    };
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isFinished(positionText: string): boolean {
  return !["R", "D", "E", "W", "N", "F"].includes(positionText);
}

function finishingPlace(positionStr: string, positionText: string): number | null {
  if (!isFinished(positionText)) return null;
  const p = parseIntField(positionStr, 0);
  return p > 0 ? p : null;
}

function shortRaceName(raceName: string): string {
  return raceName.replace(" Grand Prix", "").trim();
}

/**
 * Returns the set of rounds in the given season that include a sprint.
 * Queries the API rather than relying on a per-year hardcoded constant.
 * Falls back to an empty set if the sprint endpoint is unavailable.
 */
async function fetchSprintRounds(
  seasonRoot: string,
  year: number
): Promise<Set<number>> {
  const root = seasonRoot.replace(/\/$/, "");
  try {
    const data = await fetchJson<RawSprintScheduleResponse>(
      `${root}/${year}/sprint/?limit=30`
    );
    const rounds = data.MRData?.RaceTable?.Races ?? [];
    const set = new Set<number>();
    for (const r of rounds) {
      const round = parseIntField(r.round, 0);
      if (round > 0) set.add(round);
    }
    return set;
  } catch (e) {
    console.warn(
      `Could not fetch sprint schedule for ${year} (${
        e instanceof Error ? e.message : String(e)
      }); assuming no sprints.`
    );
    return new Set();
  }
}

export async function fetchCalendar(
  seasonRoot: string,
  year = DEFAULT_YEAR
): Promise<CalendarData> {
  const root = seasonRoot.replace(/\/$/, "");
  const [
    racesData,
    driversData,
    constructorsData,
    driverStandingsData,
    constructorStandingsData,
    sprintRounds,
  ] = await Promise.all([
    fetchJson<RawRacesResponse>(`${root}/${year}/races/?limit=30`),
    fetchJson<RawDriversResponse>(`${root}/${year}/drivers/?limit=100`),
    fetchJson<RawConstructorsResponse>(`${root}/${year}/constructors/?limit=20`),
    fetchJson<RawDriverStandingsResponse>(`${root}/${year}/driverstandings/`),
    fetchJson<RawConstructorStandingsResponse>(`${root}/${year}/constructorstandings/`),
    fetchSprintRounds(root, year),
  ]);

  const constructorsList =
    constructorsData.MRData?.ConstructorTable?.Constructors ?? [];
  const racesList = racesData.MRData?.RaceTable?.Races ?? [];
  const driversList = driversData.MRData?.DriverTable?.Drivers ?? [];

  if (racesList.length === 0) {
    throw new Error("No races returned for this season");
  }

  const teams: Record<string, Team> = {};
  for (const c of constructorsList) {
    if (!c?.constructorId) continue;
    teams[c.constructorId] = {
      id: c.constructorId,
      name: c.name ?? c.constructorId,
      color: TEAM_COLORS[c.constructorId] ?? "#888888",
      driverIds: [],
    };
  }

  const races: Race[] = racesList.map((r) => {
    const round = parseIntField(r.round, 0);
    return {
      id: round,
      name: r.raceName ?? `Round ${round}`,
      shortName: shortRaceName(r.raceName ?? ""),
      circuit: r.Circuit?.circuitName ?? "",
      date: r.date ?? "",
      hasSprint: sprintRounds.has(round),
      results: [],
    };
  });

  const rawDriverStandings: RawDriverStanding[] = (
    driverStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
  ).filter((s) => Boolean(s?.Driver?.driverId));

  const rawConstructorStandings: RawConstructorStanding[] = (
    constructorStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? []
  ).filter((s) => Boolean(s?.Constructor?.constructorId));

  if (rawDriverStandings.length === 0) {
    console.warn("Empty driver standings in response");
  }

  const driverStandings: BaselineDriverStanding[] = rawDriverStandings.map((s) => ({
    position: parseIntField(s.position, 0),
    driverId: s.Driver.driverId,
    points: parseFloatField(s.points, 0),
    wins: parseIntField(s.wins, 0),
    teamId: s.Constructors[0]?.constructorId ?? "",
  }));

  const constructorStandings: BaselineConstructorStanding[] = rawConstructorStandings.map((s) => ({
    position: parseIntField(s.position, 0),
    teamId: s.Constructor.constructorId,
    points: parseFloatField(s.points, 0),
    wins: parseIntField(s.wins, 0),
  }));

  const driverTeamMap = new Map<string, string>();
  for (const s of rawDriverStandings) {
    const teamId = s.Constructors[0]?.constructorId ?? "";
    driverTeamMap.set(s.Driver.driverId, teamId);
  }

  const drivers: Record<string, Driver> = {};
  for (const d of driversList) {
    if (!d?.driverId) continue;
    const teamId = driverTeamMap.get(d.driverId) ?? "";
    drivers[d.driverId] = driverFromRawRow(d, teamId);
    if (teamId && teams[teamId] && !teams[teamId].driverIds.includes(d.driverId)) {
      teams[teamId].driverIds.push(d.driverId);
    }
  }

  for (const s of rawDriverStandings) {
    const id = s.Driver.driverId;
    if (drivers[id]) continue;
    const teamId = s.Constructors[0]?.constructorId ?? "";
    drivers[id] = driverFromRawRow(s.Driver, teamId);
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

export async function fetchRaceResults(
  seasonRoot: string,
  round: number,
  hasSprint: boolean,
  year = DEFAULT_YEAR
): Promise<RaceResultPayload> {
  const root = seasonRoot.replace(/\/$/, "");
  const [resultsData, sprintData] = await Promise.all([
    fetchJson<RawResultsResponse>(`${root}/${year}/${round}/results/?limit=25`),
    hasSprint
      ? fetchJson<RawSprintResponse>(`${root}/${year}/${round}/sprint/?limit=10`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const driverTeams: Record<string, string> = {};
  const raceRow = resultsData.MRData?.RaceTable?.Races?.[0];
  if (!raceRow) {
    return { results: [], driverTeams: {}, driversPatch: {} };
  }

  const rawResults = raceRow.Results ?? [];
  const rawSprint = sprintData?.MRData?.RaceTable?.Races?.[0]?.SprintResults ?? [];

  const sprintPosMap = new Map(
    rawSprint.map((s) => [
      s.Driver.driverId,
      finishingPlace(s.position, s.positionText),
    ])
  );

  const results: RaceEntry[] = rawResults.map((r) => {
    driverTeams[r.Driver.driverId] = r.Constructor.constructorId;
    return {
      driverId: r.Driver.driverId,
      position: finishingPlace(r.position, r.positionText),
      sprintPosition: sprintPosMap.get(r.Driver.driverId) ?? null,
    };
  });

  for (const s of rawSprint) {
    driverTeams[s.Driver.driverId] = s.Constructor.constructorId;
  }

  const driversPatch: Record<string, Driver> = {};
  const addFromResult = (driver: RawDriverRow, constructorId: string) => {
    const id = driver.driverId;
    if (driversPatch[id]) return;
    driversPatch[id] = driverFromRawRow(driver, constructorId);
  };
  for (const r of rawResults) {
    addFromResult(r.Driver, r.Constructor.constructorId);
  }
  for (const s of rawSprint) {
    addFromResult(s.Driver, s.Constructor.constructorId);
  }

  return { results, driverTeams, driversPatch };
}
