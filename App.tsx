import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSeasonData } from "./hooks/useSeasonData";
import { useRaceStore } from "./store/useRaceStore";
import RaceListScreen from "./screens/RaceListScreen";
import EditRaceScreen from "./screens/EditRaceScreen";
import StandingsScreen from "./screens/StandingsScreen";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

type Screen =
  | { name: "raceList" }
  | { name: "editRace"; raceId: number }
  | { name: "standings" };

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#e8002d" />
      <Text style={styles.loadingText}>Loading 2025 season...</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>Failed to load season data</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "raceList" });
  const seasonData = useSeasonData();
  const { loadSeason, isSeasonLoaded } = useRaceStore();

  // Once data is fetched, push it into the store (only once)
  useEffect(() => {
    if (seasonData.status === "success" && !isSeasonLoaded) {
      loadSeason(seasonData.data);
    }
  }, [seasonData.status, isSeasonLoaded]);

  const goToRaceList  = () => setScreen({ name: "raceList" });
  const goToEditRace  = (raceId: number) => setScreen({ name: "editRace", raceId });
  const goToStandings = () => setScreen({ name: "standings" });

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={styles.root}>
      {seasonData.status === "loading" && <LoadingScreen />}

      {seasonData.status === "error" && (
        <ErrorScreen message={seasonData.error} onRetry={seasonData.retry} />
      )}

      {seasonData.status === "success" && (
        <>
          {screen.name === "raceList" && (
            <RaceListScreen
              onSelectRace={goToEditRace}
              onOpenStandings={goToStandings}
            />
          )}
          {screen.name === "editRace" && (
            <EditRaceScreen raceId={screen.raceId} onBack={goToRaceList} />
          )}
          {screen.name === "standings" && (
            <StandingsScreen onBack={goToRaceList} />
          )}
        </>
      )}
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 12,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  errorMessage: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#e8002d",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
