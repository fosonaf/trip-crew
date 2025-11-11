import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppQueryClientProvider } from "@/providers/query-client-provider";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0C1B33" }}>
      <SafeAreaProvider>
        <AppQueryClientProvider>
          <AuthProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0C1B33" },
              }}
            />
            <StatusBar style="light" />
          </AuthProvider>
        </AppQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

