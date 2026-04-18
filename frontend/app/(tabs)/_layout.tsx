import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";

const TAB_META: Record<string, { title: string; icon: string }> = {
  index: { title: "Home", icon: "home-variant" },
  pdf: { title: "PDF", icon: "file-pdf-box" },
  image: { title: "Image", icon: "image-multiple" },
  scanner: { title: "Scanner", icon: "line-scan" },
  profile: { title: "Profile", icon: "account-circle" },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={["bottom"]} style={{ backgroundColor: theme.colors.surface.background }}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface.card,
            borderColor: theme.colors.border.subtle,
            ...theme.shadow.md,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_META[route.name] ?? { title: route.name, icon: "circle" };

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <TabButton
              key={route.key}
              title={meta.title}
              icon={meta.icon}
              focused={isFocused}
              onPress={onPress}
              activeColor={theme.colors.brand.default}
              inactiveColor={theme.colors.text.muted}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  title,
  icon,
  focused,
  onPress,
  activeColor,
  inactiveColor,
}: {
  title: string;
  icon: string;
  focused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}) {
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 160 }),
    transform: [{ scaleX: withTiming(focused ? 1 : 0.3, { duration: 180 }) }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.tabBtn} hitSlop={4}>
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: activeColor },
          indicatorStyle,
        ]}
      />
      <Icon source={icon} size={22} color={focused ? activeColor : inactiveColor} />
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          color: focused ? activeColor : inactiveColor,
          fontFamily: focused ? undefined : undefined,
          fontWeight: focused ? "600" : "500",
          marginTop: 2,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="pdf" options={{ title: "PDF" }} />
      <Tabs.Screen name="image" options={{ title: "Image" }} />
      <Tabs.Screen name="scanner" options={{ title: "Scanner" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 6,
    marginTop: 4,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
    gap: 0,
  },
  indicator: {
    position: "absolute",
    top: -6,
    height: 3,
    width: 22,
    borderRadius: 2,
  },
});
