import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashIntro } from "@/components/SplashIntro";
import { SnackbarProvider } from "@/providers/SnackbarProvider";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/tokens";
import { darkTheme, lightTheme } from "@/theme/paperTheme";
import { createLogger } from "@/utils/logger";

const log = createLogger("root");

SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_DURATION_MS = 1800;

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  const palette = colors[mode];

  useEffect(() => {
    hydrate().catch((err) => log.warn("Auth hydrate failed", err));
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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.surface.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.brand.default} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [splashDone, setSplashDone] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontError) log.warn("Font load failed, falling back to system", fontError);
  }, [fontError]);

  const onReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors[mode].surface.background }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ErrorBoundary>
            <SnackbarProvider>
              <AuthGate>
                <Slot />
              </AuthGate>
            </SnackbarProvider>
          </ErrorBoundary>
          {!splashDone ? (
            <SplashIntro duration={SPLASH_DURATION_MS} onFinished={() => setSplashDone(true)} />
          ) : null}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
