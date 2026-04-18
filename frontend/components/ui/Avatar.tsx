import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface AvatarProps {
  name?: string;
  email?: string;
  size?: "sm" | "md" | "lg" | "xl";
  style?: ViewStyle;
}

const sizes = { sm: 32, md: 44, lg: 64, xl: 88 } as const;

function initials(nameOrEmail?: string): string {
  if (!nameOrEmail) return "•";
  const [head] = nameOrEmail.trim().split(/[\s@]+/).filter(Boolean);
  if (!head) return "•";
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return head.slice(0, 2).toUpperCase();
}

export function Avatar({ name, email, size = "md", style }: AvatarProps) {
  const theme = useAppTheme();
  const dim = sizes[size];
  const initial = initials(name || email);

  const fontSize = size === "xl" ? 28 : size === "lg" ? 22 : size === "md" ? 16 : 12;

  return (
    <View style={[{ width: dim, height: dim, borderRadius: dim / 2, overflow: "hidden" }, style]}>
      <Svg width={dim} height={dim} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.gradients.aiGlow[0]} />
            <Stop offset="0.5" stopColor={theme.gradients.aiGlow[1]} />
            <Stop offset="1" stopColor={theme.gradients.aiGlow[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={dim} height={dim} fill="url(#avatarGrad)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: theme.fontFamily.bold,
            fontSize,
            lineHeight: fontSize + 2,
          }}
        >
          {initial}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
