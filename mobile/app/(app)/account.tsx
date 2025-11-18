import { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { Stack } from "expo-router";
import { isAxiosError } from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/api/auth";

type FormState = {
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type FieldErrors = Partial<FormState>;

export default function AccountScreen() {
  const { user, refreshProfile } = useAuth();

  const [form, setForm] = useState<FormState>({
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    }));
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return "TC";
    const first = user.firstName?.charAt(0) ?? "";
    const last = user.lastName?.charAt(0) ?? "";
    const label = `${first}${last}`.trim();
    return label ? label.toUpperCase() : "TC";
  }, [user]);

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetPasswords = () =>
    setForm((prev) => ({
      ...prev,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    if (!form.phone.trim()) {
      setError("Le numéro de téléphone est obligatoire.");
      setFieldErrors({ phone: "Le numéro de téléphone est obligatoire." });
      return;
    }

    const wantsPasswordChange =
      form.currentPassword.trim().length > 0 ||
      form.newPassword.trim().length > 0 ||
      form.confirmPassword.trim().length > 0;

    if (wantsPasswordChange) {
      if (
        !form.currentPassword.trim() ||
        !form.newPassword.trim() ||
        !form.confirmPassword.trim()
      ) {
        setError("Merci de remplir tous les champs liés au mot de passe.");
        setFieldErrors({
          currentPassword: !form.currentPassword.trim()
            ? "Le mot de passe actuel est requis."
            : undefined,
          newPassword: !form.newPassword.trim() ? "Le nouveau mot de passe est requis." : undefined,
          confirmPassword: !form.confirmPassword.trim()
            ? "La confirmation est requise."
            : undefined,
        });
        return;
      }

      if (form.newPassword.trim().length < 8) {
        setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        setFieldErrors({
          newPassword: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
        });
        return;
      }

      if (form.newPassword !== form.confirmPassword) {
        setError("La confirmation doit correspondre au nouveau mot de passe.");
        setFieldErrors({
          confirmPassword: "La confirmation doit correspondre au nouveau mot de passe.",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await authApi.updateProfile({
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        currentPassword: wantsPasswordChange ? form.currentPassword : undefined,
        newPassword: wantsPasswordChange ? form.newPassword : undefined,
        confirmPassword: wantsPasswordChange ? form.confirmPassword : undefined,
      });

      await refreshProfile();
      setSuccess(
        wantsPasswordChange
          ? "Profil et mot de passe mis à jour avec succès."
          : "Profil mis à jour avec succès.",
      );
      resetPasswords();
      Keyboard.dismiss();
    } catch (err) {
      let message = "Une erreur inattendue est survenue. Merci de réessayer.";
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
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Mon compte",
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 48 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>
                <Text style={styles.avatarName}>
                  {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
                </Text>
                <Text style={styles.avatarSubtitle}>Gère tes informations personnelles</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Coordonnées</Text>
                <Text style={styles.helper}>
                  Tes informations de contact sont partagées avec les membres de tes événements pour
                  faciliter l’organisation.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Email (optionnel)</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={handleChange("email")}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="ton-email@example.com"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Téléphone *</Text>
                  <TextInput
                    value={form.phone}
                    onChangeText={handleChange("phone")}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="+33600000000"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[
                      styles.input,
                      fieldErrors.phone ? styles.inputError : undefined,
                    ]}
                  />
                  {fieldErrors.phone ? <Text style={styles.fieldError}>{fieldErrors.phone}</Text> : null}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Mot de passe</Text>
                <Text style={styles.helper}>
                  Pour modifier ton mot de passe, indique l’actuel puis choisis un nouveau mot de
                  passe d’au moins 8 caractères.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de passe actuel</Text>
                  <TextInput
                    value={form.currentPassword}
                    onChangeText={handleChange("currentPassword")}
                    secureTextEntry
                    placeholder="********"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[
                      styles.input,
                      fieldErrors.currentPassword ? styles.inputError : undefined,
                    ]}
                  />
                  {fieldErrors.currentPassword ? (
                    <Text style={styles.fieldError}>{fieldErrors.currentPassword}</Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Nouveau mot de passe</Text>
                  <TextInput
                    value={form.newPassword}
                    onChangeText={handleChange("newPassword")}
                    secureTextEntry
                    placeholder="********"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[styles.input, fieldErrors.newPassword ? styles.inputError : undefined]}
                  />
                  {fieldErrors.newPassword ? (
                    <Text style={styles.fieldError}>{fieldErrors.newPassword}</Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirmation</Text>
                  <TextInput
                    value={form.confirmPassword}
                    onChangeText={handleChange("confirmPassword")}
                    secureTextEntry
                    placeholder="********"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[
                      styles.input,
                      fieldErrors.confirmPassword ? styles.inputError : undefined,
                    ]}
                  />
                  {fieldErrors.confirmPassword ? (
                    <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
                  ) : null}
                </View>
              </View>

              {error ? <Text style={[styles.feedback, styles.feedbackError]}>{error}</Text> : null}
              {success ? (
                <Text style={[styles.feedback, styles.feedbackSuccess]}>{success}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.buttonLabel}>
                  {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
                </Text>
              </TouchableOpacity>
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
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  avatarWrapper: {
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(80, 227, 194, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  avatarName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  avatarSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  card: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  helper: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 20,
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#FF6B6B",
  },
  fieldError: {
    color: "#FF6B6B",
    fontSize: 13,
  },
  feedback: {
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  feedbackError: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    color: "#FFB5B5",
  },
  feedbackSuccess: {
    backgroundColor: "rgba(80, 227, 194, 0.12)",
    color: "#9CF2DE",
  },
  button: {
    backgroundColor: "rgba(80, 227, 194, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(80, 227, 194, 0.4)",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(80, 227, 194, 0.9)",
  },
});

