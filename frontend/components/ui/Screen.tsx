import { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/useTheme";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  background?: "default" | "subtle" | "inverse";
  contentStyle?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardShouldPersistTaps?: "never" | "always" | "handled";
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  background = "default",
  contentStyle,
  edges = ["bottom"],
  refreshing,
  onRefresh,
  keyboardShouldPersistTaps = "handled",
}: ScreenProps) {
  const theme = useAppTheme();

  const bg =
    background === "subtle"
      ? theme.colors.surface.subtle
      : background === "inverse"
      ? theme.colors.surface.inverse
      : theme.colors.surface.background;

  const containerPadding = padded ? { padding: theme.spacing.lg } : null;

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={edges}>
        <View style={[styles.flex, containerPadding, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={edges}>
      <ScrollView
        contentContainerStyle={[containerPadding, { gap: theme.spacing.lg }, contentStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={theme.colors.brand.default}
              colors={[theme.colors.brand.default]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
