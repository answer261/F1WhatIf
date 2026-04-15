import type { Driver, RaceEntry, SeasonData } from "../data/f1-constants";

/** End-of-season driver table row (bundled snapshot / scoring baseline). */
export type BaselineDriverStanding = {
  position: number;
  driverId: string;
  points: number;
  wins: number;
  teamId: string;
};

/** End-of-season constructor table row. */
export type BaselineConstructorStanding = {
  position: number;
  teamId: string;
  points: number;
  wins: number;
};

/** Calendar + standings payload used when hydrating the store. */
export type CalendarData = {
  seasonData: SeasonData;
  driverStandings: BaselineDriverStanding[];
  constructorStandings: BaselineConstructorStanding[];
};

/** Parsed result of one race round (main + optional sprint). */
export type RaceResultPayload = {
  results: RaceEntry[];
  driverTeams: Record<string, string>;
  /** Drivers in this round missing from the season list (substitutes, etc.). */
  driversPatch: Record<string, Driver>;
};
