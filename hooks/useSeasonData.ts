import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCalendar } from "../services/jolpica";
import type { SeasonData } from "../data/f1-constants";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// Only caches the calendar skeleton (no results).
// Results are cached separately per-race inside the store.
const CACHE_KEY = "f1_calendar_2025_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CacheEntry = {
  fetchedAt: number;
  data: SeasonData;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type SeasonDataState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "success"; data: SeasonData; fromCache: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSeasonData(): SeasonDataState {
  const [state, setState] = useState<SeasonDataState>({ status: "loading" });

  const load = async () => {
    setState({ status: "loading" });
    try {
      const cached = await readCache();
      if (cached) {
        setState({ status: "success", data: cached.data, fromCache: true });
        return;
      }

      const data = await fetchCalendar();
      await writeCache(data);
      setState({ status: "success", data, fromCache: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      // Fall back to stale cache on network failure
      const stale = await readCache({ ignoreExpiry: true });
      if (stale) {
        console.warn("Network error, using stale cache:", message);
        setState({ status: "success", data: stale.data, fromCache: true });
        return;
      }

      setState({ status: "error", error: message, retry: load });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function readCache(
  opts: { ignoreExpiry?: boolean } = {}
): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS && !opts.ignoreExpiry) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(data: SeasonData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch (err) {
    console.warn("Failed to write calendar cache:", err);
  }
}

export async function clearSeasonCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
