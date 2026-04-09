import { Platform, type ViewStyle } from "react-native";

/**
 * Extra vertical padding on Android. Core SafeAreaView + safe-area-context
 * still leave some devices tight against the status bar / gesture inset.
 */
export const androidScreenVerticalPad: ViewStyle =
  Platform.OS === "android"
    ? { paddingTop: 10, paddingBottom: 16 }
    : {};
