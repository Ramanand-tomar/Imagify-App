import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "react-native-paper";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface ChipGroupProps<T extends string> {
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
  wrap?: boolean;
  style?: ViewStyle;
}

export function ChipGroup<T extends string>({ value, options, onChange, wrap, style }: ChipGroupProps<T>) {
  const theme = useAppTheme();

  return (
    <View style={[wrap ? styles.wrapRow : styles.row, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? theme.colors.brand.default : theme.colors.surface.card,
                borderColor: active ? theme.colors.brand.default : theme.colors.border.default,
                opacity: pressed ? 0.88 : 1,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            {opt.icon ? (
              <Icon source={opt.icon} size={14} color={active ? "#FFFFFF" : theme.colors.text.secondary} />
            ) : null}
            <Text
              variant="titleSm"
              style={{ color: active ? "#FFFFFF" : theme.colors.text.primary }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "nowrap" },
  wrapRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
});
