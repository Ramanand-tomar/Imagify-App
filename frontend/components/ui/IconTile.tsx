import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";
import { Badge } from "./Badge";

export type IconTileTone = "brand" | "violet" | "cyan" | "emerald" | "amber" | "rose";

export interface IconTileProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress?: () => void;
  tone?: IconTileTone;
  badge?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

const tones = {
  brand: { bg: "#EEF2FF", fg: "#4F46E5", ring: "#C7D2FE" },
  violet: { bg: "#F3EEFF", fg: "#7C3AED", ring: "#DDD6FE" },
  cyan: { bg: "#ECFEFF", fg: "#0891B2", ring: "#A5F3FC" },
  emerald: { bg: "#ECFDF5", fg: "#059669", ring: "#A7F3D0" },
  amber: { bg: "#FFFBEB", fg: "#B45309", ring: "#FDE68A" },
  rose: { bg: "#FFF1F2", fg: "#BE123C", ring: "#FECDD3" },
} as const;

export function IconTile({ title, subtitle, icon, onPress, tone = "brand", badge, disabled, style }: IconTileProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);

  const palette = tones[tone];

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!disabled) scale.value = 0.97;
        }}
        onPressOut={() => {
          scale.value = 1;
        }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: theme.colors.surface.card,
            borderRadius: theme.radius.lg,
            borderColor: theme.colors.border.subtle,
            opacity: disabled ? 0.5 : pressed ? 0.96 : 1,
            ...theme.shadow.sm,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: palette.bg, borderColor: palette.ring }]}>
          <Icon source={icon} size={24} color={palette.fg} />
        </View>
        {badge ? (
          <View style={styles.badgeWrap}>
            <Badge label={badge} tone="brand" />
          </View>
        ) : null}
        <Text variant="titleMd" numberOfLines={1} style={{ marginTop: theme.spacing.md }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 14,
    borderWidth: 1,
    minHeight: 124,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeWrap: { position: "absolute", top: 10, right: 10 },
});
