import { create } from "zustand";
import type { SeasonData, RaceEntry } from "../data/f1-constants";
import type { SeasonYear } from "../services/bundledSeason";
import type {
  BaselineConstructorStanding,
  BaselineDriverStanding,
  RaceResultPayload,
} from "../services/seasonTypes";
import {
  applyOverridesToStandings,
  type RaceOverrides,
  type DriverStanding,
  type ConstructorStanding,
} from "../utils/scoring";
import { mergeRacePayloadIntoSeason } from "../utils/mergeSeasonRaceResults";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RaceLoadState = "idle" | "loading" | "loaded" | "error";

export type StoreState = {
  seasonData: SeasonData | null;
  loadedSeasonYear: SeasonYear | null;
  preloadedRaceResults: Record<number, RaceResultPayload>;

  baselineDriverStandings: BaselineDriverStanding[];
  baselineConstructorStandings: BaselineConstructorStanding[];

  localDriverStandings: DriverStanding[];
  localConstructorStandings: ConstructorStanding[];

  raceLoadStates: Record<number, RaceLoadState>;
  overrides: RaceOverrides;

  // driverId → teamId, populated as races are loaded
  driverTeamMap: Record<string, string>;

  loadSeason: (
    data: SeasonData,
    driverStandings: BaselineDriverStanding[],
    constructorStandings: BaselineConstructorStanding[],
    preloadedRaceResults: Record<number, RaceResultPayload>,
    seasonYear: SeasonYear
  ) => void;
  loadRaceResults: (raceId: number) => Promise<void>;
  setRaceResults: (raceId: number, results: RaceEntry[]) => void;
  resetRace: (raceId: number) => void;
  resetAll: () => void;
  isRaceModified: (raceId: number) => boolean;
  isRaceResultsLoaded: (raceId: number) => boolean;
  getResultsForRace: (raceId: number) => RaceEntry[];
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function recalculate(
  state: Pick<
    StoreState,
    | "seasonData"
    | "baselineDriverStandings"
    | "baselineConstructorStandings"
    | "overrides"
    | "driverTeamMap"
  >
): { drivers: DriverStanding[]; constructors: ConstructorStanding[] } {
  if (!state.seasonData) return { drivers: [], constructors: [] };
  return applyOverridesToStandings(
    state.baselineDriverStandings,
    state.baselineConstructorStandings,
    state.overrides,
    state.seasonData.races,
    state.driverTeamMap,
    state.seasonData.drivers
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useRaceStore = create<StoreState>((set, get) => ({
  seasonData: null,
  loadedSeasonYear: null,
  preloadedRaceResults: {},
  baselineDriverStandings: [],
  baselineConstructorStandings: [],
  localDriverStandings: [],
  localConstructorStandings: [],
  raceLoadStates: {},
  overrides: {},
  driverTeamMap: {},

  loadSeason: (data, driverStandings, constructorStandings, preloadedRaceResults, seasonYear) => {
    const safeDriverStandings = driverStandings ?? [];
    const safeConstructorStandings = constructorStandings ?? [];

    let driverTeamMap: Record<string, string> = {};
    for (const s of safeDriverStandings) {
      if (s?.driverId && s?.teamId) {
        driverTeamMap[s.driverId] = s.teamId;
      }
    }

    let seasonData: SeasonData = data;
    const raceLoadStates: Record<number, RaceLoadState> = {};

    if (preloadedRaceResults && Object.keys(preloadedRaceResults).length > 0) {
      const ordered = [...data.races].sort((a, b) => a.id - b.id);
      for (const race of ordered) {
        const payload = preloadedRaceResults[race.id];
        if (!payload) continue;
        seasonData = mergeRacePayloadIntoSeason(
          seasonData,
          race.id,
          payload.results,
          payload.driversPatch
        );
        driverTeamMap = { ...driverTeamMap, ...payload.driverTeams };
        raceLoadStates[race.id] = "loaded";
      }
    }

    set({
      seasonData,
      loadedSeasonYear: seasonYear,
      preloadedRaceResults,
      baselineDriverStandings: safeDriverStandings,
      baselineConstructorStandings: safeConstructorStandings,
      driverTeamMap,
      localDriverStandings: [],
      localConstructorStandings: [],
      overrides: {},
      raceLoadStates,
    });
  },

  loadRaceResults: async (raceId) => {
    const { seasonData, raceLoadStates } = get();
    if (!seasonData) return;

    const state = raceLoadStates[raceId];
    if (state === "loaded" || state === "loading") return;

    const race = seasonData.races.find((r) => r.id === raceId);
    if (!race) return;

    set((s) => ({
      raceLoadStates: { ...s.raceLoadStates, [raceId]: "loading" },
    }));

    const fallback = get().preloadedRaceResults[raceId];
    if (!fallback) {
      console.error(`No bundled results for round ${raceId}`);
      set((s) => ({
        raceLoadStates: { ...s.raceLoadStates, [raceId]: "error" },
      }));
      return;
    }

    try {
      const { results, driverTeams, driversPatch } = fallback;

      set((s) => {
        if (!s.seasonData) return s;

        const updatedSeasonData = mergeRacePayloadIntoSeason(
          s.seasonData,
          raceId,
          results,
          driversPatch
        );
        const updatedDriverTeamMap = { ...s.driverTeamMap, ...driverTeams };
        const hasOverrides = Object.keys(s.overrides).length > 0;

        let localDriverStandings = s.localDriverStandings;
        let localConstructorStandings = s.localConstructorStandings;

        if (hasOverrides) {
          const recalced = applyOverridesToStandings(
            s.baselineDriverStandings,
            s.baselineConstructorStandings,
            s.overrides,
            updatedSeasonData.races,
            updatedDriverTeamMap,
            updatedSeasonData.drivers
          );
          localDriverStandings = recalced.drivers;
          localConstructorStandings = recalced.constructors;
        }

        return {
          ...s,
          seasonData: updatedSeasonData,
          driverTeamMap: updatedDriverTeamMap,
          localDriverStandings,
          localConstructorStandings,
          raceLoadStates: { ...s.raceLoadStates, [raceId]: "loaded" },
        };
      });
    } catch (err) {
      console.error(`Failed to load results for round ${raceId}:`, err);
      set((s) => ({
        raceLoadStates: { ...s.raceLoadStates, [raceId]: "error" },
      }));
    }
  },

  setRaceResults: (raceId, results) => {
    const current = get();
    if (!current.seasonData) return;

    const overrides = { ...current.overrides, [raceId]: results };
    const { drivers, constructors } = recalculate({ ...current, overrides });
    set({ overrides, localDriverStandings: drivers, localConstructorStandings: constructors });
  },

  resetRace: (raceId) => {
    const current = get();
    if (!current.seasonData) return;

    const overrides = { ...current.overrides };
    delete overrides[raceId];

    if (Object.keys(overrides).length === 0) {
      set({ overrides, localDriverStandings: [], localConstructorStandings: [] });
      return;
    }

    const { drivers, constructors } = recalculate({ ...current, overrides });
    set({ overrides, localDriverStandings: drivers, localConstructorStandings: constructors });
  },

  resetAll: () => {
    set({ overrides: {}, localDriverStandings: [], localConstructorStandings: [] });
  },

  isRaceModified: (raceId) => raceId in get().overrides,
  isRaceResultsLoaded: (raceId) => get().raceLoadStates[raceId] === "loaded",

  getResultsForRace: (raceId) => {
    const { seasonData, overrides } = get();
    return (
      overrides[raceId] ??
      seasonData?.races.find((r) => r.id === raceId)?.results ??
      []
    );
  },
}));