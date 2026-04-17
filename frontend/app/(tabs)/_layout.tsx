import { Tabs } from "expo-router";
import { Icon } from "react-native-paper";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4F46E5",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Icon source="home-variant" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pdf"
        options={{
          title: "PDF",
          tabBarIcon: ({ color, size }) => <Icon source="file-pdf-box" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="image"
        options={{
          title: "Image",
          tabBarIcon: ({ color, size }) => <Icon source="image-multiple" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => <Icon source="scanner" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Icon source="account-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
