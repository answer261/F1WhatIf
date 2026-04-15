  // ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Driver = {
  id: string;           // Stable driver id, e.g. "max_verstappen"
  name: string;         // full name
  short: string;        // 3-letter code, e.g. "VER"
  teamId: string;       // Constructor id, e.g. "red_bull"
  flag: string;         // emoji flag
};

export type Team = {
  id: string;           // Constructor id, e.g. "red_bull"
  name: string;         // display name
  color: string;        // hex color
  driverIds: string[];  // Driver ids
};

export type RaceEntry = {
  driverId: string;
  position: number | null;
  sprintPosition?: number | null;
};

export type Race = {
  id: number;
  name: string;
  shortName: string;
  circuit: string;
  date: string;
  hasSprint: boolean;
  results: RaceEntry[];
};

export type SeasonData = {
  drivers: Record<string, Driver>;
  teams: Record<string, Team>;
  races: Race[];
};

// ─────────────────────────────────────────────────────────────────────────────
// TEAM COLORS
// These are fixed branding choices, not read from bundled data.
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_COLORS: Record<string, string> = {
  mclaren:      "#FF8000",
  red_bull:     "#3671C6",
  ferrari:      "#E8002D",
  mercedes:     "#27F4D2",
  williams:     "#64C4FF",
  aston_martin: "#229971",
  alpine:       "#FF87BC",
  haas:         "#B6BABD",
  sauber:       "#52E252",
  rb:           "#6692FF",   // Racing Bulls
};

// ─────────────────────────────────────────────────────────────────────────────
// NATIONALITY → FLAG EMOJI
// ─────────────────────────────────────────────────────────────────────────────

export const NATIONALITY_FLAGS: Record<string, string> = {
  British:      "🇬🇧",
  Dutch:        "🇳🇱",
  Monegasque:   "🇲🇨",
  Spanish:      "🇪🇸",
  Australian:   "🇦🇺",
  German:       "🇩🇪",
  French:       "🇫🇷",
  Italian:      "🇮🇹",
  Canadian:     "🇨🇦",
  Japanese:     "🇯🇵",
  Thai:         "🇹🇭",
  "New Zealander": "🇳🇿",
  Argentine:    "🇦🇷",
  Brazilian:    "🇧🇷",
  Finnish:      "🇫🇮",
  American:     "🇺🇸",
  Austrian:     "🇦🇹",
  Chinese:      "🇨🇳",
  Mexican:      "🇲🇽",
  // Common reserve / extra nationalities not in the core grid list above
  Estonian:     "🇪🇪",
  Danish:       "🇩🇰",
  Swedish:      "🇸🇪",
  Swiss:        "🇨🇭",
  Irish:        "🇮🇪",
  Portuguese:   "🇵🇹",
  Belgian:      "🇧🇪",
  Polish:       "🇵🇱",
  Colombian:    "🇨🇴",
  "South African": "🇿🇦",
  Malaysian:    "🇲🇾",
  Indonesian:   "🇮🇩",
  Indian:       "🇮🇳",
  Korean:       "🇰🇷",
  Israeli:      "🇮🇱",
};

export function getFlag(nationality: string): string {
  return NATIONALITY_FLAGS[nationality] ?? "🏁";
}

// ─────────────────────────────────────────────────────────────────────────────
// POINTS TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const RACE_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8,  7: 6,  8: 4,  9: 2,  10: 1,
};

export const SPRINT_POINTS: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

/** F1 positions are 1-based; `0` / null / undefined mean no points (not a valid finishing position). */
export function getRacePoints(position: number | null | undefined): number {
  if (!position) return 0;
  return RACE_POINTS[position] ?? 0;
}

/** Sprint points use grid positions 1–8 only; `0` / null / undefined → no points. */
export function getSprintPoints(position: number | null | undefined): number {
  if (!position) return 0;
  return SPRINT_POINTS[position] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT ROUNDS 2025
// ─────────────────────────────────────────────────────────────────────────────

export const SPRINT_ROUNDS_2025 = new Set([2, 6, 13, 19, 21, 23]);
