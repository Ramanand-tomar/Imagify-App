import React from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Banner, Text } from "react-native-paper";

interface Props {
  visible: boolean;
}

export const ServerStatusBanner: React.FC<Props> = ({ visible }) => {
  return (
    <Banner
      visible={visible}
      actions={[]}
      style={styles.banner}
      contentStyle={styles.content}
    >
      <View style={styles.row}>
        <ActivityIndicator size={20} color="#4F46E5" />
        <View style={styles.textContainer}>
          <Text variant="titleSmall" style={styles.title}>
            Server is waking up...
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            We're starting things up. Please wait a moment.
          </Text>
        </View>
      </View>
    </Banner>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#EEF2FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7FF",
    elevation: 2,
  },
  content: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    color: "#1E1B4B",
  },
  subtitle: {
    color: "#4338CA",
  },
});
