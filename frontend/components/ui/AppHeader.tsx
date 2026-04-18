import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** "auto" hides the back arrow when there's no history; "always" shows it; "never" hides it */
  back?: "auto" | "always" | "never";
  onBack?: () => void;
  rightSlot?: ReactNode;
  /** Transparent header — sits over gradient heroes etc. */
  transparent?: boolean;
  style?: ViewStyle;
}

export function AppHeader({
  title,
  subtitle,
  back = "auto",
  onBack,
  rightSlot,
  transparent,
  style,
}: AppHeaderProps) {
  const theme = useAppTheme();
  const router = useRouter();

  const canGoBack = router.canGoBack();
  const showBack = back === "always" || (back === "auto" && canGoBack);

  const handleBack = () => {
    if (onBack) return onBack();
    if (canGoBack) router.back();
  };

  const fg = transparent ? "#FFFFFF" : theme.colors.text.primary;
  const subFg = transparent ? "rgba(255,255,255,0.75)" : theme.colors.text.secondary;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[
        { backgroundColor: transparent ? "transparent" : theme.colors.surface.background },
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: pressed
                  ? transparent
                    ? "rgba(255,255,255,0.18)"
                    : theme.colors.surface.subtle
                  : "transparent",
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Icon source="chevron-left" size={26} color={fg} />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.titles}>
          <Text variant="titleLg" numberOfLines={1} style={{ color: fg }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" numberOfLines={1} style={{ color: subFg, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightSlot}>{rightSlot ?? <View style={styles.spacer} />}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 52,
  },
  titles: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  spacer: { width: 40, height: 40 },
  rightSlot: { minWidth: 40, alignItems: "flex-end" },
});
