# Adding a Missing Grand Prix to the Bundled Season

This guide explains how to update `data/bundled-season-<year>.json` when a new race has finished and you want the app to ship with those results offline (without waiting for users to fetch from the API).

The bundled file contains:

- **Calendar** — drivers, teams, race schedule, and current standings
- **`raceResultsByRound`** — finishing positions per round (keyed by round number as a string, e.g. `"12"`)

Data is fetched from the [Jolpica API](https://api.jolpi.ca/ergast/f1) (Ergast successor).

---

## Quick steps (recommended)

### 1. Open a terminal in the project root

```bash
cd F1WhatIf
```

### 2. Find which round is missing

Each race in the calendar has an `id` (round number). Check which rounds already have results:

**PowerShell**

```powershell
node -e "const d=require('./data/bundled-season-2026.json'); const filled=Object.entries(d.raceResultsByRound).filter(([,v])=>v.results?.length).map(([k])=>k).sort((a,b)=>a-b); console.log('filled:', filled.join(', '));"
```

**bash**

```bash
node -e "const d=require('./data/bundled-season-2026.json'); const filled=Object.entries(d.raceResultsByRound).filter(([,v])=>v.results?.length).map(([k])=>k).sort((a,b)=>a-b); console.log('filled:', filled.join(', '));"
```

The next empty round is the one to add. Round numbers match the F1 calendar, for example:

| Round | Race |
|------:|------|
| 12 | Dutch (Netherlands) |
| 13 | Italian (Monza) |
| 14 | Spanish (Madring) |

You can also confirm on the API that results exist before patching:

```text
https://api.jolpi.ca/ergast/f1/2026/13/results/
```

If the response has an empty `Results` array, the race has not been published yet.

### 3. Run the patch script

**Direct (works everywhere, including Windows PowerShell):**

```bash
npx tsx scripts/patch-bundled-round.ts --year=2026 --round=13
```

**Via npm** (use env vars on Windows if `--` args are not passed through):

```bash
npm run patch-round -- --year=2026 --round=13
```

**PowerShell alternative:**

```powershell
$env:SEASON_YEAR=2026; $env:SEASON_ROUND=13; npm run patch-round
```

- `--year` / `SEASON_YEAR` — season year (defaults to the current calendar year if omitted)
- `--round` / `SEASON_ROUND` — round number to fetch (required)

Example for the Dutch GP:

```bash
npx tsx scripts/patch-bundled-round.ts --year=2026 --round=12
```

The script will:

1. Fetch race results (and sprint results if that round has a sprint) from Jolpica
2. Write them into `raceResultsByRound["<round>"]`
3. Refresh driver and constructor standings from the API
4. Add any new drivers from that race into `seasonData.drivers` (e.g. a mid-season substitute)

Expected output:

```text
Fetching 2026 round 12 (Dutch) from https://api.jolpi.ca/ergast/f1...
Updated data/bundled-season-2026.json
  Round 12: 22 results, winner norris
  Standings leader: antonelli (242 pts)
```

### 4. Verify the update

```bash
node -e "const d=require('./data/bundled-season-2026.json'); const r=d.raceResultsByRound['13']; console.log('results:', r?.results?.length ?? 0); console.log('top 3:', d.calendar.driverStandings.slice(0,3));"
```

Replace `'13'` with your round number.

### 5. Commit the change

Only commit when you are ready to ship the update:

```bash
git add data/bundled-season-2026.json
git commit -m "Add round 13 results to bundled 2026 season"
```

---

## What gets updated in the JSON

For round `N`, the script sets:

```json
{
  "raceResultsByRound": {
    "N": {
      "results": [
        { "driverId": "norris", "position": 1, "sprintPosition": null }
      ],
      "driverTeams": { "norris": "mclaren" },
      "driversPatch": { "norris": { "id": "norris", "name": "...", "short": "NOR", "teamId": "mclaren", "flag": "🇬🇧" } }
    }
  },
  "calendar": {
    "driverStandings": [ ... ],
    "constructorStandings": [ ... ]
  }
}
```

- **`results`** — one entry per driver; `position: null` means DNF/DSQ/not classified
- **`sprintPosition`** — set only on sprint weekends; otherwise `null`
- **`driverTeams`** — team each driver raced for that weekend (can differ from season baseline after swaps)
- **`driversPatch`** — driver display info merged into the season if missing

---

## Alternative: rebuild the entire season

If you want to refresh **all** rounds at once (slower, many API calls):

```bash
npm run bundle-season -- --year=2026
```

This rewrites the whole `data/bundled-season-2026.json` from the API. Use this for a full reset; for adding one new race after a weekend, `patch-round` is faster and safer.

---

## Troubleshooting

### `No results returned for round N`

The race has not happened yet, or Jolpica has not published results. Check the URL in a browser or wait until results appear on the API.

### `Round N not found in bundled calendar`

The calendar in the bundled file does not include that round. Regenerate the calendar with `npm run bundle-season -- --year=2026`, or add the race entry manually to `calendar.seasonData.races`.

### Rate limiting (429)

The full `bundle-season` script retries with backoff. For `patch-round`, wait a minute and run again.

### Different API endpoint

Set a custom base URL:

```bash
SEASON_BUNDLE_BASE_URL=https://api.jolpi.ca/ergast/f1 npm run patch-round -- --year=2026 --round=13
```

---

## Related files

| File | Purpose |
|------|---------|
| `data/bundled-season-2026.json` | Bundled offline data shipped with the app |
| `scripts/patch-bundled-round.ts` | Single-round fetch + merge script |
| `scripts/fetch-bundled-season.ts` | Full-season rebuild script |
| `scripts/seasonBundleFetch.ts` | Shared API fetch helpers (not used at runtime) |
| `services/bundledSeason.ts` | App import of bundled JSON |
