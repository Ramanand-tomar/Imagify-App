import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useColorScheme, View, ActivityIndicator } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SnackbarProvider } from "@/providers/SnackbarProvider";
import { useAuthStore } from "@/stores/authStore";
import { darkTheme, lightTheme } from "@/theme/paperTheme";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === "auth";
    if (!accessToken && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (accessToken && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [hydrated, accessToken, segments, router]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ErrorBoundary>
            <SnackbarProvider>
              <AuthGate>
                <Slot />
              </AuthGate>
            </SnackbarProvider>
          </ErrorBoundary>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
