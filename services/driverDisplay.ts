import { getFlag, type Driver } from "../data/f1-constants";

/** Minimal driver row shape when parsing raw JSON into season data. */
export type RawDriverRow = {
  driverId: string;
  code?: string;
  givenName?: string;
  familyName?: string;
  nationality?: string;
};

/** Build app `Driver` from a raw row (missing code / nationality on reserves). */
export function driverFromRawRow(d: RawDriverRow, teamId: string): Driver {
  const given = d.givenName?.trim() ?? "";
  const family = d.familyName?.trim() ?? "";
  const name =
    given && family
      ? `${given} ${family}`
      : given || family || d.driverId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const code = d.code?.trim();
  const asciiFamily = family
    ? family.normalize("NFD").replace(/\p{M}/gu, "")
    : "";
  const short =
    code ||
    (asciiFamily.length >= 3 ? asciiFamily.slice(0, 3).toUpperCase() : "") ||
    d.driverId.replace(/^.*_/, "").slice(0, 3).toUpperCase() ||
    "???";

  return {
    id: d.driverId,
    name,
    short,
    teamId,
    flag: d.nationality ? getFlag(d.nationality) : "🏁",
  };
}
