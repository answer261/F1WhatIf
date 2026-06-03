import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { androidScreenVerticalPad } from "../utils/androidScreenPad";
import { useRaceStore } from "../store/useRaceStore";
import type { Race } from "../data/f1-constants";
import type { SeasonYear } from "../services/bundledSeason";
import SeasonPicker from "../components/SeasonPicker";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  seasonYear: SeasonYear;
  availableYears: readonly SeasonYear[];
  onSelectSeason: (year: SeasonYear) => void;
  onSelectRace: (raceId: number) => void;
  onOpenStandings: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RACE CARD
// ─────────────────────────────────────────────────────────────────────────────

type RaceCardProps = {
  race: Race;
  isModified: boolean;
  onPress: () => void;
  onReset: () => void;
};

const RaceCard = React.memo(({
  race,
  isModified,
  onPress,
  onReset,
}: RaceCardProps) => (
  <TouchableOpacity
    style={[styles.card, isModified && styles.cardModified]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    {/* Round badge */}
    <View style={styles.roundBadge}>
      <Text style={styles.roundText}>R{race.id}</Text>
    </View>

    {/* Info */}
    <View style={styles.cardBody}>
      <View style={styles.cardRow}>
        <Text style={styles.raceName} numberOfLines={1}>
          {race.shortName}
        </Text>
        {race.hasSprint && (
          <View style={styles.sprintBadge}>
            <Text style={styles.sprintText}>SPRINT</Text>
          </View>
        )}
        {isModified && (
          <View style={styles.editedBadge}>
            <Text style={styles.editedText}>EDITED</Text>
          </View>
        )}
      </View>
      <Text style={styles.circuitName} numberOfLines={1}>
        {race.circuit}
      </Text>
      <Text style={styles.dateText}>{formatDate(race.date)}</Text>
    </View>

    {/* Actions — card opens editor; reset is separate to avoid nested press targets */}
    <View style={styles.cardActions}>
      {isModified && (
        <TouchableOpacity style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      )}
    </View>
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function RaceListScreen({
  seasonYear,
  availableYears,
  onSelectSeason,
  onSelectRace,
  onOpenStandings,
}: Props) {
  const { seasonData, isRaceModified, resetRace, resetAll, overrides } = useRaceStore();
  const races = seasonData?.races ?? [];
  const modifiedCount = Object.keys(overrides).length;

  const renderItem = useCallback(({ item }: { item: Race }) => (
    <RaceCard
      race={item}
      isModified={isRaceModified(item.id)}
      onPress={() => onSelectRace(item.id)}
      onReset={() => resetRace(item.id)}
    />
  ), [isRaceModified, onSelectRace, resetRace]);

  const keyExtractor = useCallback((item: Race) => String(item.id), []);

  return (
    <SafeAreaView style={[styles.container, androidScreenVerticalPad]} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>F1 {seasonYear}</Text>
          <Text style={styles.headerSub}>What If Simulator</Text>
          <SeasonPicker
            selectedYear={seasonYear}
            availableYears={availableYears}
            onSelect={onSelectSeason}
          />
        </View>
        <View style={styles.headerRight}>
          {modifiedCount > 0 && (
            <TouchableOpacity style={styles.resetAllButton} onPress={resetAll}>
              <Text style={styles.resetAllText}>Reset all ({modifiedCount})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.standingsButton} onPress={onOpenStandings}>
            <Text style={styles.standingsButtonText}>Standings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={races}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS + STYLES
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:              "#0f0f0f",
  surface:         "#1a1a1a",
  surfaceModified: "#1a1500",
  border:          "#2a2a2a",
  borderModified:  "#f5c518",
  red:             "#e8002d",
  yellow:          "#f5c518",
  white:           "#ffffff",
  grey:            "#888888",
  greyLight:       "#555555",
  sprint:          "#00bfff",
};

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.bg },
  header:             { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerLeft:         { flex: 1, marginRight: 8 },
  headerTitle:        { fontSize: 22, fontWeight: "800", color: COLORS.white, letterSpacing: 1 },
  headerSub:          { fontSize: 12, color: COLORS.grey, marginTop: 1 },
  headerRight:        { flexDirection: "row", alignItems: "center", gap: 8 },
  resetAllButton:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.yellow },
  resetAllText:       { color: COLORS.yellow, fontSize: 12, fontWeight: "600" },
  standingsButton:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.red },
  standingsButtonText:{ color: COLORS.white, fontSize: 13, fontWeight: "700" },
  listContent:        { padding: 12, gap: 8 },
  card:               { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 10 },
  cardModified:       { backgroundColor: COLORS.surfaceModified, borderColor: COLORS.borderModified },
  roundBadge:         { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  roundText:          { color: COLORS.grey, fontSize: 11, fontWeight: "700" },
  cardBody:           { flex: 1, gap: 3 },
  cardRow:            { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  raceName:           { color: COLORS.white, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  circuitName:        { color: COLORS.grey, fontSize: 12 },
  dateText:           { color: COLORS.greyLight, fontSize: 11, marginTop: 2 },
  sprintBadge:        { backgroundColor: "#00bfff22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.sprint },
  sprintText:         { color: COLORS.sprint, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  editedBadge:        { backgroundColor: "#f5c51822", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.yellow },
  editedText:         { color: COLORS.yellow, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  cardActions:        { alignItems: "flex-end", gap: 6, justifyContent: "center", minWidth: 72 },
  resetButton:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: COLORS.yellow },
  resetButtonText:    { color: COLORS.yellow, fontSize: 12, fontWeight: "600" },
});
