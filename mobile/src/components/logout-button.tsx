import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Tu es sûr de vouloir te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          if (isLoading) return;
          setIsLoading(true);
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Erreur de déconnexion", error);
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <ActivityIndicator
        style={styles.loader}
        size="small"
        color="#FFFFFF"
        accessibilityLabel="Déconnexion en cours"
      />
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogout} accessibilityLabel="Se déconnecter">
      <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loader: {
    paddingHorizontal: 12,
  },
});

