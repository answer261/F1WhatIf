import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/** Android system back — runs `handler` and consumes the event (same as in-app Back). */
export function useHardwareBack(handler: () => void) {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handler();
      return true;
    });
    return () => sub.remove();
  }, [handler]);
}
