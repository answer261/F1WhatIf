/**
 * Fetches one completed round from Jolpica and merges it into data/bundled-season-<year>.json.
 *
 * Usage:
 *   npm run patch-round -- --year=2026 --round=13
 *   npm run patch-round -- --round=13          (defaults year to current calendar year)
 *
 * Optional env:
 *   SEASON_BUNDLE_BASE_URL  API root (default: https://api.jolpi.ca/ergast/f1)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchCalendar, fetchRaceResults } from "./seasonBundleFetch";
import type { CalendarData, RaceResultPayload } from "../services/seasonTypes";

const DEFAULT_SEASON_BUNDLE_BASE_URL = "https://api.jolpi.ca/ergast/f1";

type BundledSeasonFile = {
  calendar: CalendarData;
  raceResultsByRound: Record<string, RaceResultPayload>;
};

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function resolveYear(): number {
  const raw = (parseFlag("year") ?? process.env.SEASON_YEAR ?? "").trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1950 || n > 2100) {
      console.error(`Invalid year "${raw}". Pass --year=YYYY.`);
      process.exit(1);
    }
    return n;
  }
  return new Date().getUTCFullYear();
}

function resolveRound(): number {
  const raw = (parseFlag("round") ?? process.env.SEASON_ROUND ?? "").trim();
  if (!raw) {
    console.error("Missing --round=N (e.g. --round=13 for Italian GP).");
    process.exit(1);
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 30) {
    console.error(`Invalid round "${raw}". Pass --round=N where N is 1–30.`);
    process.exit(1);
  }
  return n;
}

function resolveSeasonRoot(): string {
  const v = (process.env.SEASON_BUNDLE_BASE_URL ?? "").trim();
  const root = v || DEFAULT_SEASON_BUNDLE_BASE_URL;
  return root.replace(/\/$/, "");
}

async function main(): Promise<void> {
  const year = resolveYear();
  const round = resolveRound();
  const seasonRoot = resolveSeasonRoot();
  const path = join(process.cwd(), "data", `bundled-season-${year}.json`);

  const bundled = JSON.parse(readFileSync(path, "utf8")) as BundledSeasonFile;
  const race = bundled.calendar.seasonData.races.find((r) => r.id === round);
  if (!race) {
    console.error(`Round ${round} not found in bundled calendar for ${year}.`);
    process.exit(1);
  }

  console.log(`Fetching ${year} round ${round} (${race.shortName}) from ${seasonRoot}...`);
  const payload = await fetchRaceResults(seasonRoot, round, race.hasSprint, year);
  if (payload.results.length === 0) {
    console.error(`No results returned for round ${round}. The race may not have happened yet.`);
    process.exit(1);
  }

  const cal = await fetchCalendar(seasonRoot, year);

  bundled.raceResultsByRound[String(round)] = payload;
  bundled.calendar.driverStandings = cal.driverStandings;
  bundled.calendar.constructorStandings = cal.constructorStandings;

  for (const [id, driver] of Object.entries(payload.driversPatch)) {
    if (!bundled.calendar.seasonData.drivers[id]) {
      bundled.calendar.seasonData.drivers[id] = driver;
      const teamId = driver.teamId;
      if (teamId && bundled.calendar.seasonData.teams[teamId]) {
        const ids = bundled.calendar.seasonData.teams[teamId].driverIds;
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }

  writeFileSync(path, JSON.stringify(bundled), "utf8");

  const winner = payload.results.find((r) => r.position === 1);
  console.log(`Updated data/bundled-season-${year}.json`);
  console.log(`  Round ${round}: ${payload.results.length} results, winner ${winner?.driverId ?? "?"}`);
  console.log(
    `  Standings leader: ${cal.driverStandings[0]?.driverId ?? "?"} (${cal.driverStandings[0]?.points ?? 0} pts)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
