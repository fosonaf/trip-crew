import { useLocalSearchParams, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function EventDetailPlaceholder() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Évènement ${id ?? ""}`,
        }}
      />
      <View style={styles.card}>
        <Text style={styles.title}>Détail évènement</Text>
        <Text style={styles.subtitle}>
          L’écran de détail de l’évènement sera bientôt disponible sur mobile. Pour consulter tous
          les détails, utilise la version web ou reviens plus tard.
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

