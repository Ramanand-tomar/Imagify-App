import React from "react";
import { StyleSheet, View } from "react-native";

import { Button, EmptyState, Text } from "@/components/ui";

interface Props {
  children: React.ReactNode;
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
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          description="An unexpected error occurred. You can try again — your data is safe."
        />
        <View style={{ paddingHorizontal: 32 }}>
          <Text variant="caption" tone="muted" align="center" numberOfLines={3}>
            {this.state.error.message}
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
  container: { flex: 1, alignItems: "stretch", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#F7F8FC" },
});
