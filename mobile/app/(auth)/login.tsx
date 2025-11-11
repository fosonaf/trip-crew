import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { isAxiosError } from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!phone.trim() || !password.trim()) {
      setError("Merci de renseigner ton téléphone et ton mot de passe.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ phone: phone.trim(), password });
      router.replace("/(app)");
    } catch (err) {
      let message = "Impossible de t’authentifier. Réessaie.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 48 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
              <View style={styles.card}>
                <Text style={styles.title}>Connexion</Text>
                <Text style={styles.subtitle}>
                  Accède à tes événements Trip Crew en te connectant avec ton numéro de téléphone.
                </Text>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Téléphone</Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      textContentType="telephoneNumber"
                      placeholder="+33600000000"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Mot de passe</Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      textContentType="password"
                      placeholder="********"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.button, isSubmitting && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.buttonLabel}>
                      {isSubmitting ? "Connexion..." : "Se connecter"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0C1B33",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 22,
  },
  form: {
    marginTop: 8,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 16,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#50E3C2",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0C1B33",
  },
});

