import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCalendar, type CalendarData } from "../services/jolpica";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// Only caches the calendar skeleton (no results).
// Results are cached separately per-race inside the store.
const CACHE_KEY = "f1_calendar_2025_v4";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CacheEntry = {
  fetchedAt: number;
  data: CalendarData;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type SeasonDataState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "success"; data: CalendarData; fromCache: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSeasonData(): SeasonDataState {
  const [state, setState] = useState<SeasonDataState>({ status: "loading" });

  const refreshInBackground = useCallback(async () => {
    try {
      const data = await fetchCalendar();
      await writeCache(data);
      setState((prev) => {
        if (prev.status !== "success") return prev;
        return { status: "success", data, fromCache: false };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Background calendar refresh failed:", msg);
    }
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const cached = await readCache();
      if (cached) {
        setState({ status: "success", data: cached.data, fromCache: true });
        void refreshInBackground();
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
        void refreshInBackground();
        return;
      }

      setState({ status: "error", error: message, retry: load });
    }
  }, [refreshInBackground]);

  useEffect(() => {
    void load();
  }, [load]);

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

async function writeCache(data: CalendarData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch (err) {
    console.warn("Failed to write calendar cache:", err);
  }
}

export async function clearSeasonCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
