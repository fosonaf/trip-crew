import { StyleSheet, View } from "react-native";
import { ProfileAvatarButton } from "./profile-avatar-button";
import { LogoutButton } from "./logout-button";

export function HeaderActions() {
  return (
    <View style={styles.container}>
      <ProfileAvatarButton />
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: -8,
  },
});

