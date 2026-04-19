import { Stack } from "expo-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ScannerStackLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
