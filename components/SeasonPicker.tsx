import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { SeasonYear } from "../services/bundledSeason";

type Props = {
  selectedYear: SeasonYear;
  availableYears: readonly SeasonYear[];
  onSelect: (year: SeasonYear) => void;
};

export default function SeasonPicker({
  selectedYear,
  availableYears,
  onSelect,
}: Props) {
  return (
    <View style={styles.row}>
      {availableYears.map((year) => {
        const active = year === selectedYear;
        return (
          <TouchableOpacity
            key={year}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(year)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {year}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#1a1a1a",
  },
  chipActive: {
    borderColor: "#e8002d",
    backgroundColor: "#e8002d22",
  },
  chipText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#ffffff",
  },
});
