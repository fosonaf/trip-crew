import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "@/hooks/use-auth";
import { eventApi } from "@/api/events";
import type { CreateEventPayload } from "@/types/event";

type FormState = {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isPaid: boolean;
  price: string;
};

const toInputDateTime = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDateTimeInput = (value: string) => {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString();
};

export default function EventCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    isPaid: false,
    price: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isStartDatePickerVisible, setIsStartDatePickerVisible] = useState(false);
  const [isEndDatePickerVisible, setIsEndDatePickerVisible] = useState(false);

  const formatName = () => {
    if (!user?.firstName) return "Trip Crew";
    return user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase();
  };

  const validate = () => {
    if (!form.name.trim()) {
      return "Le nom de l'évènement est obligatoire.";
    }
    if (!form.startDate || !form.endDate) {
      return "Merci de renseigner les dates de début et de fin.";
    }
    const startIso = parseDateTimeInput(form.startDate);
    const endIso = parseDateTimeInput(form.endDate);
    if (!startIso || !endIso) {
      return "Merci de saisir des dates valides.";
    }
    if (new Date(endIso) < new Date(startIso)) {
      return "La date de fin doit être postérieure à la date de début.";
    }
    if (form.isPaid) {
      const priceValue = Number(form.price);
      if (!form.price || Number.isNaN(priceValue) || priceValue < 0) {
        return "Merci d'indiquer un prix valide (valeur positive).";
      }
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: async (payload: CreateEventPayload) => eventApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace(`/(app)/events/${data.id}`);
    },
    onError: (err: unknown) => {
      let message = "Impossible de créer l'évènement pour le moment. Merci de réessayer.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    },
  });

  const handleSubmit = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    const startIso = parseDateTimeInput(form.startDate)!;
    const endIso = parseDateTimeInput(form.endDate)!;

    const payload: CreateEventPayload = {
      name: form.name.trim(),
      description: form.description.trim() || "",
      location: form.location.trim() || "",
      startDate: startIso,
      endDate: endIso,
      isPaid: form.isPaid,
      price: form.isPaid ? Number(form.price) : null,
    };

    createMutation.mutate(payload);
  };

  const handleStartDateConfirm = (date: Date) => {
    setForm((prev) => ({ ...prev, startDate: toInputDateTime(date.toISOString()) }));
    setIsStartDatePickerVisible(false);
  };

  const handleEndDateConfirm = (date: Date) => {
    setForm((prev) => ({ ...prev, endDate: toInputDateTime(date.toISOString()) }));
    setIsEndDatePickerVisible(false);
  };

  const formatDateTime = (value: string) => {
    if (!value) return "Sélectionner une date";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "Sélectionner une date";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Nouvel évènement",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Nouvel évènement</Text>
          <Text style={styles.subtitle}>
            Donne un nom, des dates et un lieu à ton aventure. Nous inviterons ton équipe ensuite ! Tu
            es connecté en tant que <Text style={styles.accent}>{formatName()}</Text>.
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Nom de l'évènement *</Text>
              <TextInput
                style={styles.input}
                placeholder="Road trip en Islande"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Objectifs, ambiance, étapes clés..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={form.description}
                onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>Quelques lignes pour partager le contexte avec ton équipe.</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.fieldHalf]}>
                <Text style={styles.label}>Début *</Text>
                <Pressable
                  style={styles.dateInput}
                  onPress={() => setIsStartDatePickerVisible(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="rgba(80, 227, 194, 0.7)" />
                  <Text style={[styles.dateText, !form.startDate && styles.datePlaceholder]}>
                    {formatDateTime(form.startDate)}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.field, styles.fieldHalf]}>
                <Text style={styles.label}>Fin *</Text>
                <Pressable
                  style={styles.dateInput}
                  onPress={() => setIsEndDatePickerVisible(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="rgba(80, 227, 194, 0.7)" />
                  <Text style={[styles.dateText, !form.endDate && styles.datePlaceholder]}>
                    {formatDateTime(form.endDate)}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Lieu principal</Text>
              <TextInput
                style={styles.input}
                placeholder="Reykjavík, Islande"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={form.location}
                onChangeText={(value) => setForm((prev) => ({ ...prev, location: value }))}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.checkboxField}>
                <Switch
                  value={form.isPaid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, isPaid: value, price: value ? prev.price : "" }))
                  }
                  trackColor={{ false: "rgba(255, 255, 255, 0.2)", true: "rgba(80, 227, 194, 0.5)" }}
                  thumbColor={form.isPaid ? "#50E3C2" : "rgba(255, 255, 255, 0.8)"}
                />
                <Text style={styles.checkboxLabel}>Évènement payant</Text>
              </View>
              {form.isPaid ? (
                <View style={styles.priceField}>
                  <Text style={styles.label}>Prix par personne (€) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="250"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={form.price}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : (
                <Text style={styles.hint}>Laisse décoché si la participation est gratuite.</Text>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => router.back()}
                disabled={createMutation.isPending}
              >
                <Text style={styles.buttonSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#50E3C2" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#50E3C2" />
                    <Text style={styles.buttonPrimaryLabel}>Créer l'évènement</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <DateTimePickerModal
        isVisible={isStartDatePickerVisible}
        mode="datetime"
        date={form.startDate ? new Date(form.startDate) : new Date()}
        locale="fr-FR"
        minuteInterval={5}
        onConfirm={handleStartDateConfirm}
        onCancel={() => setIsStartDatePickerVisible(false)}
      />

      <DateTimePickerModal
        isVisible={isEndDatePickerVisible}
        mode="datetime"
        date={
          form.endDate
            ? new Date(form.endDate)
            : form.startDate
              ? new Date(form.startDate)
              : new Date()
        }
        locale="fr-FR"
        minuteInterval={5}
        onConfirm={handleEndDateConfirm}
        onCancel={() => setIsEndDatePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C1B33",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 20,
  },
  accent: {
    color: "#50E3C2",
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(80, 227, 194, 0.3)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
  },
  textarea: {
    minHeight: 100,
    paddingTop: 14,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(80, 227, 194, 0.3)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 16,
    color: "#FFFFFF",
    flex: 1,
  },
  datePlaceholder: {
    color: "rgba(255, 255, 255, 0.4)",
  },
  hint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontStyle: "italic",
  },
  checkboxField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    flex: 1,
  },
  priceField: {
    marginTop: 12,
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  buttonSecondaryLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  buttonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(80, 227, 194, 0.3)",
    borderWidth: 1.5,
    borderColor: "rgba(80, 227, 194, 0.6)",
    shadowColor: "rgba(80, 227, 194, 0.6)",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 0,
  },
  buttonPrimaryLabel: {
    color: "#50E3C2",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
