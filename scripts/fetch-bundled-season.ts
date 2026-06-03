/**
 * Regenerates data/bundled-season-<year>.json (see seasonBundleFetch.ts).
 *
 * Configuration:
 *   --year=YYYY (CLI flag) or SEASON_YEAR env var
 *     Defaults to the current calendar year.
 *   SEASON_BUNDLE_BASE_URL env var
 *     Root path for season JSON (no trailing slash).
 *     Defaults to https://api.jolpi.ca/ergast/f1 (the maintained Ergast successor).
 *
 * Examples:
 *   npm run bundle-season -- --year=2026
 *   SEASON_YEAR=2026 npm run bundle-season
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchCalendar, fetchRaceResults } from "./seasonBundleFetch";
import type { RaceResultPayload } from "../services/seasonTypes";

const DEFAULT_SEASON_BUNDLE_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const DELAY_MS = 750;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveYear(): number {
  const flag = process.argv.find((a) => a.startsWith("--year="));
  const fromFlag = flag ? flag.slice("--year=".length) : undefined;
  const raw = (fromFlag ?? process.env.SEASON_YEAR ?? "").trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1950 || n > 2100) {
      console.error(`Invalid year "${raw}". Pass --year=YYYY or set SEASON_YEAR.`);
      process.exit(1);
    }
    return n;
  }
  return new Date().getUTCFullYear();
}

function resolveSeasonRoot(): string {
  const v = (process.env.SEASON_BUNDLE_BASE_URL ?? "").trim();
  const root = v || DEFAULT_SEASON_BUNDLE_BASE_URL;
  return root.replace(/\/$/, "");
}

async function main(): Promise<void> {
  const year = resolveYear();
  const seasonRoot = resolveSeasonRoot();
  console.log(`Fetching ${year} calendar + standings from ${seasonRoot}...`);
  const calendar = await fetchCalendar(seasonRoot, year);
  const raceResultsByRound: Record<number, RaceResultPayload> = {};

  const races = [...calendar.seasonData.races].sort((a, b) => a.id - b.id);
  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    if (i > 0) await sleep(DELAY_MS);
    process.stdout.write(`  Round ${race.id} ${race.shortName}... `);
    let payload: RaceResultPayload | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        payload = await fetchRaceResults(seasonRoot, race.id, race.hasSprint, year);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("429") && attempt < 4) {
          const backoff = 3000 * (attempt + 1);
          console.log(`rate limited, retry in ${backoff}ms...`);
          await sleep(backoff);
          continue;
        }
        throw e;
      }
    }
    if (!payload) throw new Error("No payload for round " + race.id);
    raceResultsByRound[race.id] = payload;
    console.log(`${payload.results.length} results`);
  }

  const out = { calendar, raceResultsByRound };
  const outPath = join(process.cwd(), "data", `bundled-season-${year}.json`);
  writeFileSync(outPath, JSON.stringify(out), "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
