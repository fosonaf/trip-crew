import { Stack } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

const MOCK_EVENTS = [
  { id: "1", name: "Séminaire entreprise", date: "12 déc. 2025" },
  { id: "2", name: "Voyage CE Barcelone", date: "05 janv. 2026" },
];

export default function EventsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Événements",
          headerShown: true,
        }}
      />
      <View style={styles.container}>
        <FlatList
          data={MOCK_EVENTS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{item.date}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun événement pour le moment.</Text>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  list: {
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#0C1B33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0C1B33",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#657193",
  },
  empty: {
    textAlign: "center",
    color: "#657193",
    fontSize: 16,
  },
});

