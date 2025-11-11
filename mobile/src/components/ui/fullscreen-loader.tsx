import { ActivityIndicator, StyleSheet, View } from "react-native";

export function FullscreenLoader() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#50E3C2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C1B33",
  },
});

