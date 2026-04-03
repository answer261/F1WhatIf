import { create } from "zustand";
import { fetchRaceResults } from "../services/jolpica";
import type { SeasonData, RaceEntry } from "../data/f1-constants";
import {
  calculateStandings,
  type RaceOverrides,
  type DriverStanding,
  type ConstructorStanding,
} from "../utils/scoring";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RaceLoadState = "idle" | "loading" | "loaded" | "error";

export type StoreState = {
  seasonData: SeasonData | null;
  isSeasonLoaded: boolean;

  // Per-race result loading
  raceLoadStates: Record<number, RaceLoadState>;

  overrides: RaceOverrides;
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];

  // Actions
  loadSeason: (data: SeasonData) => void;
  loadRaceResults: (raceId: number) => Promise<void>;
  setRaceResults: (raceId: number, results: RaceEntry[]) => void;
  resetRace: (raceId: number) => void;
  resetAll: () => void;
  isRaceModified: (raceId: number) => boolean;
  isRaceResultsLoaded: (raceId: number) => boolean;
  getResultsForRace: (raceId: number) => RaceEntry[];
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useRaceStore = create<StoreState>((set, get) => ({
  seasonData: null,
  isSeasonLoaded: false,
  raceLoadStates: {},
  overrides: {},
  driverStandings: [],
  constructorStandings: [],

  loadSeason: (data) => {
    // Standings are empty until results are loaded — that's fine,
    // the standings screen will reflect whatever has been loaded so far.
    set({
      seasonData: data,
      isSeasonLoaded: true,
      driverStandings: [],
      constructorStandings: [],
    });
  },

  loadRaceResults: async (raceId) => {
    const { seasonData, raceLoadStates } = get();
    if (!seasonData) return;

    // Skip if already loaded or currently loading
    const state = raceLoadStates[raceId];
    if (state === "loaded" || state === "loading") return;

    const race = seasonData.races.find((r) => r.id === raceId);
    if (!race) return;

    set((s) => ({
      raceLoadStates: { ...s.raceLoadStates, [raceId]: "loading" },
    }));

    try {
      const { results, driverTeams } = await fetchRaceResults(
        raceId,
        race.hasSprint
      );

      // Patch race results into seasonData
      const updatedRaces = seasonData.races.map((r) =>
        r.id === raceId ? { ...r, results } : r
      );

      // Patch driver teamIds from results (most reliable source)
      const updatedDrivers = { ...seasonData.drivers };
      for (const [driverId, teamId] of Object.entries(driverTeams)) {
        if (updatedDrivers[driverId]) {
          updatedDrivers[driverId] = { ...updatedDrivers[driverId], teamId };
        }
        // Add driver to team's driverIds
        const teams = seasonData.teams;
        if (teams[teamId] && !teams[teamId].driverIds.includes(driverId)) {
          teams[teamId] = {
            ...teams[teamId],
            driverIds: [...teams[teamId].driverIds, driverId],
          };
        }
      }

      const updatedSeasonData: SeasonData = {
        ...seasonData,
        races: updatedRaces,
        drivers: updatedDrivers,
      };

      const { overrides } = get();
      const { drivers, constructors } = calculateStandings(
        updatedSeasonData,
        overrides
      );

      set({
        seasonData: updatedSeasonData,
        driverStandings: drivers,
        constructorStandings: constructors,
        raceLoadStates: { ...get().raceLoadStates, [raceId]: "loaded" },
      });
    } catch (err) {
      console.error(`Failed to load results for round ${raceId}:`, err);
      set((s) => ({
        raceLoadStates: { ...s.raceLoadStates, [raceId]: "error" },
      }));
    }
  },

  setRaceResults: (raceId, results) => {
    const { seasonData } = get();
    if (!seasonData) return;
    const overrides = { ...get().overrides, [raceId]: results };
    const { drivers, constructors } = calculateStandings(seasonData, overrides);
    set({ overrides, driverStandings: drivers, constructorStandings: constructors });
  },

  resetRace: (raceId) => {
    const { seasonData } = get();
    if (!seasonData) return;
    const overrides = { ...get().overrides };
    delete overrides[raceId];
    const { drivers, constructors } = calculateStandings(seasonData, overrides);
    set({ overrides, driverStandings: drivers, constructorStandings: constructors });
  },

  resetAll: () => {
    const { seasonData } = get();
    if (!seasonData) return;
    const { drivers, constructors } = calculateStandings(seasonData, {});
    set({ overrides: {}, driverStandings: drivers, constructorStandings: constructors });
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
