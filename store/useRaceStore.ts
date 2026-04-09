import { create } from "zustand";
import { fetchRaceResults } from "../services/jolpica";
import type { SeasonData, RaceEntry } from "../data/f1-constants";
import type { ApiDriverStanding, ApiConstructorStanding } from "../services/jolpica";
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
  isSeasonLoaded: boolean;

  apiDriverStandings: ApiDriverStanding[];
  apiConstructorStandings: ApiConstructorStanding[];

  localDriverStandings: DriverStanding[];
  localConstructorStandings: ConstructorStanding[];

  raceLoadStates: Record<number, RaceLoadState>;
  overrides: RaceOverrides;

  // driverId → teamId, populated as races are loaded
  driverTeamMap: Record<string, string>;

  loadSeason: (
    data: SeasonData,
    driverStandings: ApiDriverStanding[],
    constructorStandings: ApiConstructorStanding[]
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
    | "apiDriverStandings"
    | "apiConstructorStandings"
    | "overrides"
    | "driverTeamMap"
  >
): { drivers: DriverStanding[]; constructors: ConstructorStanding[] } {
  if (!state.seasonData) return { drivers: [], constructors: [] };
  return applyOverridesToStandings(
    state.apiDriverStandings,
    state.apiConstructorStandings,
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
  isSeasonLoaded: false,
  apiDriverStandings: [],
  apiConstructorStandings: [],
  localDriverStandings: [],
  localConstructorStandings: [],
  raceLoadStates: {},
  overrides: {},
  driverTeamMap: {},

  loadSeason: (data, driverStandings, constructorStandings) => {
    const safeDriverStandings = driverStandings ?? [];
    const safeConstructorStandings = constructorStandings ?? [];

    const driverTeamMap: Record<string, string> = {};
    for (const s of safeDriverStandings) {
      if (s?.driverId && s?.teamId) {
        driverTeamMap[s.driverId] = s.teamId;
      }
    }

    set({
      seasonData: data,
      isSeasonLoaded: true,
      apiDriverStandings: safeDriverStandings,
      apiConstructorStandings: safeConstructorStandings,
      driverTeamMap,
      localDriverStandings: [],
      localConstructorStandings: [],
      overrides: {},
      raceLoadStates: {},
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

    try {
      const { results, driverTeams, driversPatch } = await fetchRaceResults(raceId, race.hasSprint);

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
            s.apiDriverStandings,
            s.apiConstructorStandings,
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