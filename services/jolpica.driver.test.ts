import { driverFromJolpica } from "./jolpica";

describe("driverFromJolpica", () => {
  it("builds display name from given + family", () => {
    const d = driverFromJolpica(
      {
        driverId: "john_doe",
        givenName: "John",
        familyName: "Doe",
        code: "DOE",
        nationality: "British",
      },
      "mclaren"
    );
    expect(d.name).toBe("John Doe");
    expect(d.short).toBe("DOE");
    expect(d.teamId).toBe("mclaren");
    expect(d.flag).toBe("🇬🇧");
  });

  it("falls back when code missing", () => {
    const d = driverFromJolpica(
      { driverId: "foo_bar", givenName: "", familyName: "Barcelona", nationality: undefined },
      "ferrari"
    );
    expect(d.short.length).toBe(3);
    expect(d.teamId).toBe("ferrari");
  });
});
