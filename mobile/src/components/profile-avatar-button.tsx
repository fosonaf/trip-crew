import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export function ProfileAvatarButton() {
  const { user } = useAuth();
  const router = useRouter();

  const initials = useMemo(() => {
    if (!user) return "TC";
    const first = user.firstName?.charAt(0) ?? "";
    const last = user.lastName?.charAt(0) ?? "";
    const label = `${first}${last}`.trim();
    return label ? label.toUpperCase() : "TC";
  }, [user]);

  const handlePress = () => {
    router.push("/(app)/account");
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la gestion du compte"
    >
      {user?.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.initials}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

const SIZE = 36;

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(80, 227, 194, 0.15)",
    marginRight: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  initials: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});

