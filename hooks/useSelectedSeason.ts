import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BUNDLED_SEASON_YEARS,
  type SeasonYear,
  isSeasonYear,
} from "../services/bundledSeason";

const STORAGE_KEY = "@f1whatif/selectedSeasonYear";
const DEFAULT_YEAR: SeasonYear = 2026;

export type SelectedSeasonState = {
  isReady: boolean;
  selectedYear: SeasonYear;
  setSelectedYear: (year: SeasonYear) => void;
  availableYears: readonly SeasonYear[];
};

export function useSelectedSeason(): SelectedSeasonState {
  const [isReady, setIsReady] = useState(false);
  const [selectedYear, setSelectedYearState] = useState<SeasonYear>(DEFAULT_YEAR);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = Number(raw);
          if (isSeasonYear(parsed)) {
            setSelectedYearState(parsed);
          }
        }
      } catch {
        // Keep default year on read failure
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedYear = useCallback((year: SeasonYear) => {
    setSelectedYearState(year);
    AsyncStorage.setItem(STORAGE_KEY, String(year)).catch(() => {});
  }, []);

  return {
    isReady,
    selectedYear,
    setSelectedYear,
    availableYears: BUNDLED_SEASON_YEARS,
  };
}
