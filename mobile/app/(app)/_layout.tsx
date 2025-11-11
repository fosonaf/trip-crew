import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { FullscreenLoader } from "@/components/ui/fullscreen-loader";
import { LogoutButton } from "@/components/logout-button";

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "idle" || status === "loading") {
    return <FullscreenLoader />;
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0C1B33" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#0C1B33" },
        animation: "fade",
        headerRight: () => <LogoutButton />,
      }}
    />
  );
}

