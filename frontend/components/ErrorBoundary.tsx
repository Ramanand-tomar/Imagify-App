import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

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
        <Text variant="headlineSmall" style={styles.title}>Something went wrong</Text>
        <Text variant="bodyMedium" style={styles.body}>
          An unexpected error occurred. You can try again — your data is safe.
        </Text>
        <Text variant="bodySmall" style={styles.detail} numberOfLines={3}>
          {this.state.error.message}
        </Text>
        <Button mode="contained" onPress={this.reset} icon="restart" style={styles.btn}>
          Try again
        </Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#F9FAFB" },
  title: { fontWeight: "700", color: "#111827" },
  body: { textAlign: "center", color: "#4B5563" },
  detail: { textAlign: "center", color: "#9CA3AF", fontFamily: "monospace" },
  btn: { marginTop: 8 },
});
