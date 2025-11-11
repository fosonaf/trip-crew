import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { FullscreenLoader } from "@/components/ui/fullscreen-loader";

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === "idle" || status === "loading") {
    return <FullscreenLoader />;
  }

  if (status === "authenticated") {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C1B33" },
        animation: "fade",
      }}
    />
  );
}

