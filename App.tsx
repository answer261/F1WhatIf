import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSeasonData } from "./hooks/useSeasonData";
import { useRaceStore } from "./store/useRaceStore";
import RaceListScreen from "./screens/RaceListScreen";
import EditRaceScreen from "./screens/EditRaceScreen";
import StandingsScreen from "./screens/StandingsScreen";

type Screen =
  | { name: "raceList" }
  | { name: "editRace"; raceId: number }
  | { name: "standings" };

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#e8002d" />
      <Text style={styles.loadingText}>Loading 2025 season...</Text>
    </View>
  );
}

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

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "raceList" });
  const seasonData = useSeasonData();
  const { loadSeason, isSeasonLoaded } = useRaceStore();

  useEffect(() => {
    if (seasonData.status === "success" && !isSeasonLoaded) {
      loadSeason(
        seasonData.data.seasonData,
        seasonData.data.driverStandings,
        seasonData.data.constructorStandings
      );
    }
  }, [seasonData.status, isSeasonLoaded]);

  return (
    <GestureHandlerRootView style={styles.root}>
      {seasonData.status === "loading" && <LoadingScreen />}
      {seasonData.status === "error" && (
        <ErrorScreen message={seasonData.error} onRetry={seasonData.retry} />
      )}
      {seasonData.status === "success" && (
        <>
          {screen.name === "raceList" && (
            <RaceListScreen
              onSelectRace={(id) => setScreen({ name: "editRace", raceId: id })}
              onOpenStandings={() => setScreen({ name: "standings" })}
            />
          )}
          {screen.name === "editRace" && (
            <EditRaceScreen raceId={screen.raceId} onBack={() => setScreen({ name: "raceList" })} />
          )}
          {screen.name === "standings" && (
            <StandingsScreen onBack={() => setScreen({ name: "raceList" })} />
          )}
        </>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#0f0f0f" },
  centered:     { flex: 1, backgroundColor: "#0f0f0f", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  loadingText:  { color: "#888", fontSize: 14, marginTop: 12 },
  errorTitle:   { color: "#ffffff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  errorMessage: { color: "#888", fontSize: 13, textAlign: "center" },
  retryBtn:     { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: "#e8002d", borderRadius: 8 },
  retryText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
});
