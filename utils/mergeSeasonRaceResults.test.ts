import { mergeRacePayloadIntoSeason } from "./mergeSeasonRaceResults";
import type { SeasonData, RaceEntry, Driver } from "../data/f1-constants";

const baseSeason = (): SeasonData => ({
  drivers: {
    a: { id: "a", name: "A", short: "AAA", teamId: "t1", flag: "🏁" },
  },
  teams: {
    t1: { id: "t1", name: "T1", color: "#fff", driverIds: ["a"] },
  },
  races: [
    {
      id: 1,
      name: "R1",
      shortName: "R1",
      circuit: "C",
      date: "2025-01-01",
      hasSprint: false,
      results: [],
    },
    {
      id: 2,
      name: "R2",
      shortName: "R2",
      circuit: "C",
      date: "2025-01-02",
      hasSprint: false,
      results: [{ driverId: "a", position: 1, sprintPosition: null }],
    },
  ],
});

describe("mergeRacePayloadIntoSeason", () => {
  it("patches only the requested round and preserves other rounds", () => {
    const season = baseSeason();
    const newResults: RaceEntry[] = [{ driverId: "a", position: 2, sprintPosition: null }];
    const next = mergeRacePayloadIntoSeason(season, 1, newResults, {});
    expect(next.races.find((r) => r.id === 1)?.results).toEqual(newResults);
    expect(next.races.find((r) => r.id === 2)?.results).toEqual(season.races[1].results);
  });

  it("merges driversPatch without dropping existing drivers", () => {
    const season = baseSeason();
    const patch: Record<string, Driver> = {
      b: { id: "b", name: "B", short: "BBB", teamId: "t1", flag: "🏁" },
    };
    const next = mergeRacePayloadIntoSeason(season, 1, [], patch);
    expect(next.drivers.a).toEqual(season.drivers.a);
    expect(next.drivers.b).toEqual(patch.b);
  });

  it("composes: two sequential merges both stick (simulates concurrent resolutions)", () => {
    let season = baseSeason();
    season = mergeRacePayloadIntoSeason(
      season,
      1,
      [{ driverId: "a", position: 3, sprintPosition: null }],
      {}
    );
    season = mergeRacePayloadIntoSeason(
      season,
      2,
      [{ driverId: "a", position: 5, sprintPosition: null }],
      {}
    );
    expect(season.races.find((r) => r.id === 1)?.results[0]?.position).toBe(3);
    expect(season.races.find((r) => r.id === 2)?.results[0]?.position).toBe(5);
  });
});
