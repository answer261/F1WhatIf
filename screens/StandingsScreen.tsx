import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { androidScreenVerticalPad } from "../utils/androidScreenPad";
import { useRaceStore } from "../store/useRaceStore";
import { useHardwareBack } from "../hooks/useHardwareBack";

type Tab = "drivers" | "constructors";
type Props = { seasonYear: number; onBack: () => void };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getMedalColor(position: number): string {
  if (position === 1) return "#FFD700";
  if (position === 2) return "#C0C0C0";
  if (position === 3) return "#CD7F32";
  return "#888888";
}

function getDeltaLabel(delta: number): string {
  if (delta > 0) return `▲${delta}`;
  if (delta < 0) return `▼${Math.abs(delta)}`;
  return "–";
}

function getDeltaColor(delta: number): string {
  if (delta > 0) return "#22c55e";
  if (delta < 0) return "#e8002d";
  return "#888888";
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function StandingsScreen({ seasonYear, onBack }: Props) {
  useHardwareBack(onBack);

  const [activeTab, setActiveTab] = useState<Tab>("drivers");

  const {
    seasonData,
    overrides,
    baselineDriverStandings,
    baselineConstructorStandings,
    localDriverStandings,
    localConstructorStandings,
  } = useRaceStore();

  const drivers = seasonData?.drivers ?? {};
  const teams = seasonData?.teams ?? {};
  const isModified = Object.keys(overrides).length > 0;
  const modifiedCount = Object.keys(overrides).length;

  // Use local (recalculated) standings when overrides are active,
  // otherwise show the bundled baseline standings
  const driverStandings = isModified ? localDriverStandings : baselineDriverStandings;
  const constructorStandings = isModified ? localConstructorStandings : baselineConstructorStandings;

  // Delta column: compare current position against baseline
  const baselineDriverPositions = Object.fromEntries(
    baselineDriverStandings.map((s) => [s.driverId, s.position])
  );
  const baselineConstructorPositions = Object.fromEntries(
    baselineConstructorStandings.map((s) => [s.teamId, s.position])
  );

  return (
    <SafeAreaView style={[styles.container, androidScreenVerticalPad]} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Standings</Text>
          {isModified ? (
            <View style={styles.modifiedBadge}>
              <Text style={styles.modifiedBadgeText}>
                {modifiedCount} race{modifiedCount !== 1 ? "s" : ""} modified
              </Text>
            </View>
          ) : (
            <Text style={styles.headerSub}>Official {seasonYear} results</Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["drivers", "constructors"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Column headers */}
      <View style={styles.columnHeaders}>
        <Text style={[styles.columnLabel, { width: 36 }]}>POS</Text>
        <Text style={[styles.columnLabel, { flex: 1, marginLeft: 14 }]}>
          {activeTab === "drivers" ? "DRIVER" : "TEAM"}
        </Text>
        <Text style={[styles.columnLabel, { width: 32, textAlign: "right" }]}>W</Text>
        <Text style={[styles.columnLabel, { width: 52, textAlign: "right" }]}>PTS</Text>
        {isModified && (
          <Text style={[styles.columnLabel, { width: 40, textAlign: "right" }]}>Δ</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {activeTab === "drivers"
          ? driverStandings.map((s) => {
              const driver = drivers[s.driverId];
              const team = teams[driver?.teamId ?? ""] ?? teams[s.teamId ?? ""];
              const isChampion = s.position === 1;
              const delta = isModified
                ? (baselineDriverPositions[s.driverId] ?? s.position) - s.position
                : 0;

              return (
                <View key={s.driverId} style={[styles.row, isChampion && styles.rowChampion]}>
                  <View style={styles.positionWrap}>
                    <Text style={[styles.positionText, { color: getMedalColor(s.position) }]}>
                      {s.position}
                    </Text>
                  </View>
                  <View style={[styles.teamBar, { backgroundColor: team?.color ?? "#888" }]} />
                  <View style={styles.entityInfo}>
                    <Text style={styles.flag}>{driver?.flag ?? "🏁"}</Text>
                    <View>
                      <Text style={styles.shortName}>{driver?.short ?? s.driverId}</Text>
                      <Text style={styles.fullName} numberOfLines={1}>{driver?.name ?? ""}</Text>
                    </View>
                  </View>
                  <Text style={styles.winsText}>{s.wins > 0 ? `${s.wins}W` : ""}</Text>
                  <Text style={[styles.pointsText, isChampion && styles.pointsChampion]}>
                    {s.points}
                  </Text>
                  {isModified && (
                    <View style={styles.deltaWrap}>
                      <Text style={[styles.deltaText, { color: getDeltaColor(delta) }]}>
                        {getDeltaLabel(delta)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          : constructorStandings.map((s) => {
              const team = teams[s.teamId];
              const isChampion = s.position === 1;
              const driverShorts = (team?.driverIds ?? [])
                .map((id) => drivers[id]?.short ?? "")
                .filter(Boolean)
                .join(" · ");
              const delta = isModified
                ? (baselineConstructorPositions[s.teamId] ?? s.position) - s.position
                : 0;

              return (
                <View key={s.teamId} style={[styles.row, isChampion && styles.rowChampion]}>
                  <View style={styles.positionWrap}>
                    <Text style={[styles.positionText, { color: getMedalColor(s.position) }]}>
                      {s.position}
                    </Text>
                  </View>
                  <View style={[styles.teamBar, { backgroundColor: team?.color ?? "#888" }]} />
                  <View style={styles.entityInfo}>
                    <View style={[styles.teamDot, { backgroundColor: team?.color ?? "#888" }]} />
                    <View>
                      <Text style={styles.shortName}>{team?.name ?? s.teamId}</Text>
                      <Text style={styles.fullName}>{driverShorts}</Text>
                    </View>
                  </View>
                  <Text style={styles.winsText}>{s.wins > 0 ? `${s.wins}W` : ""}</Text>
                  <Text style={[styles.pointsText, isChampion && styles.pointsChampion]}>
                    {s.points}
                  </Text>
                  {isModified && (
                    <View style={styles.deltaWrap}>
                      <Text style={[styles.deltaText, { color: getDeltaColor(delta) }]}>
                        {getDeltaLabel(delta)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS + STYLES
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:          "#0f0f0f",
  surface:     "#1a1a1a",
  surfaceGold: "#1a1500",
  border:      "#2a2a2a",
  red:         "#e8002d",
  yellow:      "#f5c518",
  white:       "#ffffff",
  grey:        "#888888",
};

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.bg },
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn:           { paddingVertical: 4, paddingHorizontal: 2, minWidth: 60 },
  backBtnText:       { color: COLORS.red, fontSize: 14, fontWeight: "600" },
  headerCenter:      { flex: 1, alignItems: "center", gap: 4 },
  headerTitle:       { color: COLORS.white, fontSize: 17, fontWeight: "800" },
  headerSub:         { color: COLORS.grey, fontSize: 11 },
  headerSpacer:      { minWidth: 60 },
  modifiedBadge:     { backgroundColor: "#f5c51822", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.yellow },
  modifiedBadgeText: { color: COLORS.yellow, fontSize: 10, fontWeight: "700" },
  tabs:              { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:               { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive:         { borderBottomWidth: 2, borderBottomColor: COLORS.red },
  tabText:           { color: COLORS.grey, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  tabTextActive:     { color: COLORS.white },
  columnHeaders:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  columnLabel:       { color: COLORS.grey, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  listContent:       { padding: 10, gap: 5, paddingBottom: 32 },
  row:               { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", height: 52, paddingRight: 10 },
  rowChampion:       { backgroundColor: COLORS.surfaceGold, borderColor: "#FFD700" },
  positionWrap:      { width: 36, alignItems: "center" },
  positionText:      { fontSize: 15, fontWeight: "800" },
  teamBar:           { width: 3, alignSelf: "stretch", marginRight: 10 },
  entityInfo:        { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  flag:              { fontSize: 18 },
  teamDot:           { width: 10, height: 10, borderRadius: 5 },
  shortName:         { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  fullName:          { color: COLORS.grey, fontSize: 10, marginTop: 1 },
  winsText:          { width: 32, textAlign: "right", color: COLORS.yellow, fontSize: 11, fontWeight: "700" },
  pointsText:        { width: 52, textAlign: "right", color: COLORS.white, fontSize: 15, fontWeight: "800" },
  pointsChampion:    { color: "#FFD700" },
  deltaWrap:         { width: 40, alignItems: "flex-end" },
  deltaText:         { fontSize: 11, fontWeight: "700" },
});
