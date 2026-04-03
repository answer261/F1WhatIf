import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useRaceStore } from "../store/useRaceStore";
import type { RaceEntry, Driver } from "../data/f1-constants";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  raceId: number;
  onBack: () => void;
};

type RowItem = {
  driverId: string;
  isDnf: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialItems(entries: RaceEntry[]): RowItem[] {
  const finishers = entries
    .filter((e) => e.position !== null)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((e) => ({ driverId: e.driverId, isDnf: false }));
  const dnfs = entries
    .filter((e) => e.position === null)
    .map((e) => ({ driverId: e.driverId, isDnf: true }));
  return [...finishers, ...dnfs];
}

function buildResultsFromItems(items: RowItem[], originalEntries: RaceEntry[]): RaceEntry[] {
  let pos = 1;
  return items.map((item) => {
    const original = originalEntries.find((e) => e.driverId === item.driverId);
    if (item.isDnf) {
      return { driverId: item.driverId, position: null, sprintPosition: original?.sprintPosition };
    }
    return { driverId: item.driverId, position: pos++, sprintPosition: original?.sprintPosition };
  });
}

function itemsEqual(a: RowItem[], b: RowItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.driverId === b[i].driverId && item.isDnf === b[i].isDnf);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER ROW
// ─────────────────────────────────────────────────────────────────────────────

type DriverRowProps = RenderItemParams<RowItem> & {
  driver: Driver | undefined;
  teamColor: string;
  displayPosition: number | null;
  isModifiedRow: boolean;
  onToggleDnf: (driverId: string) => void;
};

const DriverRow = React.memo(({
  item, drag, isActive,
  driver, teamColor,
  displayPosition, isModifiedRow,
  onToggleDnf,
}: DriverRowProps) => (
  <ScaleDecorator activeScale={1.03}>
    <View style={[
      styles.row,
      item.isDnf && styles.rowDnf,
      isModifiedRow && styles.rowModified,
      isActive && styles.rowActive,
    ]}>
      <View style={styles.positionContainer}>
        {item.isDnf
          ? <Text style={styles.dnfLabel}>DNF</Text>
          : <Text style={styles.positionText}>P{displayPosition}</Text>
        }
      </View>
      <View style={[styles.teamBar, { backgroundColor: teamColor }]} />
      <View style={styles.driverInfo}>
        <Text style={styles.driverFlag}>{driver?.flag ?? "🏁"}</Text>
        <View>
          <Text style={styles.driverShort}>{driver?.short ?? "???"}</Text>
          <Text style={styles.driverName} numberOfLines={1}>{driver?.name ?? item.driverId}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.dnfBtn, item.isDnf && styles.dnfBtnActive]}
        onPress={() => onToggleDnf(item.driverId)}
      >
        <Text style={[styles.dnfBtnText, item.isDnf && styles.dnfBtnTextActive]}>DNF</Text>
      </TouchableOpacity>
      {!item.isDnf ? (
        <TouchableOpacity style={styles.dragHandle} onLongPress={drag} delayLongPress={150}>
          <Text style={styles.dragHandleIcon}>⠿</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.dragHandlePlaceholder} />
      )}
    </View>
  </ScaleDecorator>
));

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function EditRaceScreen({ raceId, onBack }: Props) {
  const {
    seasonData,
    raceLoadStates,
    loadRaceResults,
    getResultsForRace,
    setRaceResults,
    resetRace,
    isRaceModified,
  } = useRaceStore();

  const race = useMemo(
    () => seasonData?.races.find((r) => r.id === raceId),
    [seasonData, raceId]
  );

  const drivers = seasonData?.drivers ?? {};
  const teams = seasonData?.teams ?? {};
  const loadState = raceLoadStates[raceId] ?? "idle";
  const isLoaded = loadState === "loaded";
  const isLoading = loadState === "loading";
  const hasError = loadState === "error";

  console.log("EditRaceScreen raceId:", raceId, "loadState:", loadState);

  // Trigger fetch when screen opens
  useEffect(() => {
    loadRaceResults(raceId);
  }, [raceId]);

  // Local edit state — only initialised once results are loaded
  const [items, setItems] = useState<RowItem[]>([]);
  const [editInitialised, setEditInitialised] = useState(false);

  useEffect(() => {
    if (isLoaded && !editInitialised) {
      setItems(buildInitialItems(getResultsForRace(raceId)));
      setEditInitialised(true);
    }
  }, [isLoaded, editInitialised, raceId, getResultsForRace]);

  const modified = isRaceModified(raceId);

  const originalItems = useMemo(
    () => buildInitialItems(race?.results ?? []),
    [race]
  );

  const hasUnsavedChanges = useMemo(
    () => editInitialised && !itemsEqual(items, originalItems),
    [items, originalItems, editInitialised]
  );

  const originalPositionMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    race?.results.forEach((e) => { map[e.driverId] = e.position; });
    return map;
  }, [race]);

  const positionMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    let pos = 1;
    items.forEach((item) => { map[item.driverId] = item.isDnf ? null : pos++; });
    return map;
  }, [items]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleDnf = useCallback((driverId: string) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.driverId === driverId ? { ...item, isDnf: !item.isDnf } : item
      );
      return [...updated.filter((i) => !i.isDnf), ...updated.filter((i) => i.isDnf)];
    });
  }, []);

  const handleDragEnd = useCallback(({ data }: { data: RowItem[] }) => {
    setItems([...data.filter((i) => !i.isDnf), ...data.filter((i) => i.isDnf)]);
  }, []);

  const handleSave = useCallback(() => {
    if (!race) return;
    setRaceResults(raceId, buildResultsFromItems(items, race.results));
    onBack();
  }, [items, race, raceId, setRaceResults, onBack]);

  const handleReset = useCallback(() => {
    Alert.alert("Reset race", "Restore original results for this race?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset", style: "destructive",
        onPress: () => {
          resetRace(raceId);
          setItems(buildInitialItems(race?.results ?? []));
        },
      },
    ]);
  }, [raceId, race, resetRace]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert("Unsaved changes", "Discard your changes?", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onBack },
      ]);
    } else {
      onBack();
    }
  }, [hasUnsavedChanges, onBack]);

  const renderItem = useCallback((params: RenderItemParams<RowItem>) => {
    const { driverId } = params.item;
    const driver = drivers[driverId];
    const teamColor = teams[driver?.teamId ?? ""]?.color ?? "#888";
    const currentPos = positionMap[driverId];
    const originalPos = originalPositionMap[driverId];
    const isModifiedRow =
      currentPos !== originalPos ||
      (params.item.isDnf && originalPos !== null) ||
      (!params.item.isDnf && originalPos === null);

    return (
      <DriverRow
        {...params}
        driver={driver}
        teamColor={teamColor}
        displayPosition={currentPos}
        isModifiedRow={isModifiedRow}
        onToggleDnf={toggleDnf}
      />
    );
  }, [drivers, teams, positionMap, originalPositionMap, toggleDnf]);

  const dnfCount = items.filter((i) => i.isDnf).length;

  if (!race) return null;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{race.shortName}</Text>
          <Text style={styles.headerSub}>Round {race.id} · {race.circuit}</Text>
        </View>
        {modified ? (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Hold <Text style={styles.infoHighlight}>⠿</Text> to drag · tap DNF to retire
        </Text>
        {race.hasSprint && (
          <View style={styles.sprintBadge}>
            <Text style={styles.sprintText}>SPRINT</Text>
          </View>
        )}
      </View>

      {/* Loading state */}
      {(isLoading || !isLoaded) && !hasError && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      )}

      {/* Error state */}
      {hasError && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load results</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadRaceResults(raceId)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Driver list */}
      {isLoaded && (
        <>
          {dnfCount > 0 && (
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>{20 - dnfCount} finishers · {dnfCount} DNF</Text>
            </View>
          )}

          <NestableScrollContainer
            style={styles.scrollContainer}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            <NestableDraggableFlatList
              data={items}
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => item.driverId}
              renderItem={renderItem}
              activationDistance={8}
            />
          </NestableScrollContainer>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, !hasUnsavedChanges && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!hasUnsavedChanges}
            >
              <Text style={styles.saveBtnText}>
                {hasUnsavedChanges ? "Save changes" : "No changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS + STYLES
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:              "#0f0f0f",
  surface:         "#1a1a1a",
  surfaceActive:   "#2a2a2a",
  surfaceModified: "#1c1800",
  border:          "#2a2a2a",
  red:             "#e8002d",
  yellow:          "#f5c518",
  white:           "#ffffff",
  grey:            "#888888",
  greyLight:       "#444444",
  sprint:          "#00bfff",
  dnf:             "#2a1a1a",
  dnfBorder:       "#5a2a2a",
};

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: COLORS.bg },
  header:               { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn:              { paddingVertical: 4, paddingHorizontal: 2, minWidth: 60 },
  backBtnText:          { color: COLORS.red, fontSize: 14, fontWeight: "600" },
  headerCenter:         { flex: 1, alignItems: "center" },
  headerTitle:          { color: COLORS.white, fontSize: 17, fontWeight: "800" },
  headerSub:            { color: COLORS.grey, fontSize: 11, marginTop: 1 },
  headerSpacer:         { minWidth: 60 },
  resetBtn:             { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.yellow, minWidth: 60, alignItems: "center" },
  resetBtnText:         { color: COLORS.yellow, fontSize: 12, fontWeight: "600" },
  infoBar:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoText:             { color: COLORS.grey, fontSize: 11, flex: 1 },
  infoHighlight:        { color: COLORS.white, fontSize: 13 },
  sprintBadge:          { backgroundColor: "#00bfff22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.sprint, marginLeft: 8 },
  sprintText:           { color: COLORS.sprint, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  centered:             { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:          { color: COLORS.grey, fontSize: 13 },
  errorText:            { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  retryBtn:             { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: COLORS.red, borderRadius: 8 },
  retryText:            { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  statsBar:             { paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statsText:            { color: COLORS.grey, fontSize: 11 },
  scrollContainer:      { flex: 1 },
  listContent:          { padding: 10, paddingBottom: 24 },
  row:                  { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", height: 56, marginBottom: 5 },
  rowDnf:               { backgroundColor: COLORS.dnf, borderColor: COLORS.dnfBorder, opacity: 0.75 },
  rowModified:          { borderColor: COLORS.yellow, backgroundColor: COLORS.surfaceModified },
  rowActive:            { backgroundColor: COLORS.surfaceActive, borderColor: COLORS.white, shadowColor: COLORS.white, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  positionContainer:    { width: 44, alignItems: "center", justifyContent: "center" },
  positionText:         { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  dnfLabel:             { color: COLORS.red, fontSize: 11, fontWeight: "800" },
  teamBar:              { width: 3, alignSelf: "stretch", marginRight: 10 },
  driverInfo:           { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  driverFlag:           { fontSize: 18 },
  driverShort:          { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  driverName:           { color: COLORS.grey, fontSize: 11, marginTop: 1 },
  dnfBtn:               { paddingHorizontal: 8, height: 28, borderRadius: 6, borderWidth: 1, borderColor: COLORS.greyLight, alignItems: "center", justifyContent: "center", marginRight: 6 },
  dnfBtnActive:         { borderColor: COLORS.red, backgroundColor: COLORS.red + "22" },
  dnfBtnText:           { color: COLORS.grey, fontSize: 10, fontWeight: "700" },
  dnfBtnTextActive:     { color: COLORS.red },
  dragHandle:           { paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  dragHandleIcon:       { color: COLORS.grey, fontSize: 20, lineHeight: 22 },
  dragHandlePlaceholder:{ width: 40 },
  footer:               { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn:              { backgroundColor: COLORS.red, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveBtnDisabled:      { backgroundColor: COLORS.greyLight },
  saveBtnText:          { color: COLORS.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
});
