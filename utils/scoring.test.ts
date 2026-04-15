import { applyOverridesToStandings, buildRacePointsMap } from "./scoring";
import type { Race } from "../data/f1-constants";
import type {
  BaselineConstructorStanding,
  BaselineDriverStanding,
} from "../services/seasonTypes";

describe("buildRacePointsMap", () => {
  it("awards race win points and sprint points when enabled", () => {
    const map = buildRacePointsMap(
      [
        { driverId: "a", position: 1, sprintPosition: 2 },
        { driverId: "b", position: 2, sprintPosition: null },
      ],
      true
    );
    expect(map.get("a")?.points).toBe(25 + 7);
    expect(map.get("a")?.wins).toBe(1);
    expect(map.get("b")?.points).toBe(18);
  });

  it("ignores sprint when weekend has no sprint", () => {
    const map = buildRacePointsMap(
      [{ driverId: "a", position: 1, sprintPosition: 1 }],
      false
    );
    expect(map.get("a")?.points).toBe(25);
  });
});

describe("applyOverridesToStandings", () => {
  it("applies constructor delta using driversById when baseline standing omits teamId", () => {
    const baselineDrivers: BaselineDriverStanding[] = [
      { position: 1, driverId: "a", points: 100, wins: 0, teamId: "" },
      { position: 2, driverId: "b", points: 90, wins: 0, teamId: "t2" },
    ];
    const baselineConstructors: BaselineConstructorStanding[] = [
      { position: 1, teamId: "t1", points: 100, wins: 0 },
      { position: 2, teamId: "t2", points: 80, wins: 0 },
    ];
    const races: Race[] = [
      {
        id: 1,
        name: "R1",
        shortName: "R1",
        circuit: "C",
        date: "2025-01-01",
        hasSprint: false,
        results: [
          { driverId: "a", position: 1, sprintPosition: null },
          { driverId: "b", position: 2, sprintPosition: null },
        ],
      },
    ];
    const driversById = {
      a: { id: "a", name: "A", short: "AAA", teamId: "t1", flag: "🏁" },
      b: { id: "b", name: "B", short: "BBB", teamId: "t2", flag: "🏁" },
    };
    // Swap: was a(t1) P1 + b(t2) P2 → now b P1 + a P2 → t1 loses 7, t2 gains 7
    const overrides = {
      1: [
        { driverId: "a", position: 2, sprintPosition: null },
        { driverId: "b", position: 1, sprintPosition: null },
      ],
    };
    const { constructors } = applyOverridesToStandings(
      baselineDrivers,
      baselineConstructors,
      overrides,
      races,
      {},
      driversById
    );
    expect(constructors.find((c) => c.teamId === "t1")?.points).toBe(93);
    expect(constructors.find((c) => c.teamId === "t2")?.points).toBe(87);
  });
});
