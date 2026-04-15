/**
 * Regenerates data/bundled-season-2025.json (see seasonBundleFetch.ts).
 * Requires env SEASON_BUNDLE_BASE_URL (root path for season JSON, no trailing slash).
 *
 * Run: npm run bundle-season
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchCalendar, fetchRaceResults } from "./seasonBundleFetch";
import type { RaceResultPayload } from "../services/seasonTypes";

const YEAR = 2025;
const DELAY_MS = 750;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function requiredSeasonRoot(): string {
  const v = process.env.SEASON_BUNDLE_BASE_URL?.trim();
  if (!v) {
    console.error("Set SEASON_BUNDLE_BASE_URL to the season JSON root, then retry.");
    process.exit(1);
  }
  return v.replace(/\/$/, "");
}

async function main(): Promise<void> {
  const seasonRoot = requiredSeasonRoot();
  console.log("Fetching calendar + standings...");
  const calendar = await fetchCalendar(seasonRoot, YEAR);
  const raceResultsByRound: Record<number, RaceResultPayload> = {};

  const races = [...calendar.seasonData.races].sort((a, b) => a.id - b.id);
  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    if (i > 0) await sleep(DELAY_MS);
    process.stdout.write(`  Round ${race.id} ${race.shortName}... `);
    let payload: RaceResultPayload | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        payload = await fetchRaceResults(seasonRoot, race.id, race.hasSprint, YEAR);
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
  const outPath = join(process.cwd(), "data", "bundled-season-2025.json");
  writeFileSync(outPath, JSON.stringify(out), "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
