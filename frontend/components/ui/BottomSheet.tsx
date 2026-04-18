import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export interface SheetAction {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  tone?: "default" | "destructive";
  onPress: () => void;
}

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}

export function BottomSheet({ visible, onClose, title, actions }: BottomSheetProps) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 420 }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFillObject}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000" }, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface.card,
              borderTopLeftRadius: theme.radius["2xl"],
              borderTopRightRadius: theme.radius["2xl"],
            },
            sheetStyle,
          ]}
        >
          <SafeAreaView edges={["bottom"]}>
            <View style={styles.handle} />
            {title ? (
              <Text variant="h3" align="center" style={{ marginBottom: theme.spacing.md }}>
                {title}
              </Text>
            ) : null}
            <View style={{ gap: 8 }}>
              {actions.map((action) => {
                const destructive = action.tone === "destructive";
                return (
                  <Pressable
                    key={action.key}
                    onPress={() => {
                      onClose();
                      setTimeout(action.onPress, 160);
                    }}
                    style={({ pressed }) => [
                      styles.action,
                      {
                        backgroundColor: pressed
                          ? theme.colors.surface.subtle
                          : theme.colors.surface.card,
                        borderColor: theme.colors.border.subtle,
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    {action.icon ? (
                      <View
                        style={[
                          styles.iconWrap,
                          {
                            backgroundColor: destructive
                              ? theme.colors.status.errorSoft
                              : theme.colors.brand[50],
                          },
                        ]}
                      >
                        <Icon
                          source={action.icon}
                          size={20}
                          color={destructive ? theme.colors.status.error : theme.colors.brand[700]}
                        />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="titleMd"
                        style={{ color: destructive ? theme.colors.status.error : theme.colors.text.primary }}
                      >
                        {action.label}
                      </Text>
                      {action.description ? (
                        <Text variant="caption" tone="secondary">
                          {action.description}
                        </Text>
                      ) : null}
                    </View>
                    <Icon source="chevron-right" size={20} color={theme.colors.text.muted} />
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
