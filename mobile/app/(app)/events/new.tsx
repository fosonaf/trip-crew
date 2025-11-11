import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function EventCreatePlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Nouvel évènement",
        }}
      />
      <View style={styles.card}>
        <Text style={styles.title}>Création d’évènement</Text>
        <Text style={styles.subtitle}>
          Cette fonctionnalité arrive bientôt sur mobile. En attendant, crée ton évènement depuis
          l’interface web ou contacte l’équipe Trip Crew.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1B33",
    padding: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
});

