import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur Trip Crew Mobile 🚀</Text>
      <Text style={styles.subtitle}>
        L’application mobile partage les mêmes fonctionnalités que le web, tout
        en ajoutant les scénarios terrain (invitation SMS/WhatsApp, contrôle de
        présence, scan QR code).
      </Text>
      <Link href="/events" style={styles.link}>
        Voir les événements
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0C1B33",
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: "#50E3C2",
  },
});

