import React from "react";
import { StyleSheet, View } from "react-native";

import { Button, EmptyState, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";
import { createLogger } from "@/utils/logger";

const log = createLogger("ErrorBoundary");

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error("Caught runtime error", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Unknown error";
    const truncated = message.length > 240 ? `${message.slice(0, 240)}…` : message;

    return (
      <View style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          description="An unexpected error occurred. You can try again — your data is safe."
        />
        <View style={{ paddingHorizontal: 32 }}>
          <Text variant="caption" tone="muted" align="center" numberOfLines={3} ellipsizeMode="tail">
            {truncated}
          </Text>
          <Button
            label="Try again"
            icon="restart"
            onPress={this.reset}
            fullWidth
            style={{ marginTop: 20 }}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: colors.light.surface.background,
  },
});
