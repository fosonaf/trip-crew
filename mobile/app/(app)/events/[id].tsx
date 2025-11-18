import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "@/hooks/use-auth";
import { eventApi } from "@/api/events";
import type {
  CreateEventPayload,
  CreateStepPayload,
  EventDetail,
  EventJoinRequest,
  EventMember,
  EventStep,
} from "@/types/event";

type ToastState = {
  message: string;
  variant: "success" | "error";
};

type StepFormState = {
  name: string;
  description: string;
  location: string;
  scheduledTime: string;
};

type EventFormState = {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isPaid: boolean;
  price: string;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Date inconnue";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const eventId = id ?? "";
  const eventQueryKey = ["event", eventId];

  const [toast, setToast] = useState<ToastState | null>(null);
  const [joinRequests, setJoinRequests] = useState<EventJoinRequest[]>([]);
  const [isRequestsModalVisible, setIsRequestsModalVisible] = useState(false);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isStepModalVisible, setIsStepModalVisible] = useState(false);
  const [isStepDetailModalVisible, setIsStepDetailModalVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<EventStep | null>(null);
  const [isEditEventModalVisible, setIsEditEventModalVisible] = useState(false);
  const [isUpdateConfirmationVisible, setIsUpdateConfirmationVisible] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState<StepFormState>({
    name: "",
    description: "",
    location: "",
    scheduledTime: "",
  });
  const [stepDate, setStepDate] = useState<Date | null>(null);
  const [isDateTimePickerVisible, setIsDateTimePickerVisible] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    isPaid: false,
    price: "",
  });
  const [editingStep, setEditingStep] = useState<EventStep | null>(null);
  const [pendingEventUpdate, setPendingEventUpdate] = useState<{
    payload: CreateEventPayload;
    affectedBefore: number;
    affectedAfter: number;
  } | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const eventQuery = useQuery({
    queryKey: eventQueryKey,
    queryFn: async (): Promise<EventDetail> => {
      try {
        return await eventApi.detail(eventId);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 403) {
          setAccessDenied(true);
        }
        throw err;
      }
    },
    enabled: Boolean(eventId),
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const event = eventQuery.data;
  const isLoading = eventQuery.isLoading;
  const isError = eventQuery.isError && !accessDenied;
  const errorMessage =
    isAxiosError(eventQuery.error) && eventQuery.error?.response?.data
      ? (eventQuery.error.response.data as { message?: string; error?: string })?.message ??
        (eventQuery.error.response.data as { message?: string; error?: string })?.error ??
        "Impossible de charger l’évènement."
      : "Impossible de charger l’évènement.";

  const currentMember: EventMember | null = useMemo(() => {
    if (!event || !user) return null;
    return event.members.find((member) => member.userId === user.id) ?? null;
  }, [event, user]);

  const activeOrganizerCount = useMemo(() => {
    if (!event) return 0;
    return event.members.filter(
      (member) =>
        member.status === "active" &&
        (member.role === "organizer" || member.role === "admin"),
    ).length;
  }, [event]);

  const isAdmin = useMemo(() => {
    if (!event || !user) return false;
    return event.createdBy.id === user.id;
  }, [event, user]);

  const isOrganizer = useMemo(() => {
    if (!currentMember) return false;
    return currentMember.role === "organizer" || currentMember.role === "admin";
  }, [currentMember]);

  const canLeaveEvent = useMemo(() => {
    if (!currentMember) return false;
    if (currentMember.status !== "active") return false;
    if (isAdmin) return false;
    if (currentMember.role === "organizer" && activeOrganizerCount <= 1) {
      return false;
    }
    return true;
  }, [currentMember, activeOrganizerCount, isAdmin]);

  const pendingJoinRequests = useMemo(() => {
    if (isRequestsModalVisible) {
      return joinRequests.length;
    }
    if (event?.joinRequests) {
      return event.joinRequests.length;
    }
    return event?.joinRequestCount ?? 0;
  }, [event, joinRequests.length, isRequestsModalVisible]);

  const adminName = useMemo(() => {
    if (!event) return "";
    return `${event.createdBy.firstName} ${event.createdBy.lastName}`.trim();
  }, [event]);

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
  };

  const invalidateEvent = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: eventQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
    ]);
  };

  const leaveEventMutation = useMutation({
    mutationFn: async () => eventApi.leave(eventId),
    onSuccess: async () => {
      showToast("Tu as quitté l’évènement.", "success");
      await invalidateEvent();
      router.replace("/(app)/events");
    },
    onError: (err: unknown) => {
      let message = "Impossible de quitter l’évènement pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const togglePhoneVisibilityMutation = useMutation({
    mutationFn: async () => {
      if (!currentMember) return;
      const nextValue = !currentMember.showPhone;
      await eventApi.updateMemberPreferences(eventId, { showPhone: nextValue });
      return nextValue;
    },
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Préférence de visibilité mise à jour.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de mettre à jour la visibilité pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (phone: string) => eventApi.invite(eventId, { phone }),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Invitation envoyée.", "success");
      setInvitePhone("");
      setInviteError(null);
      setIsInviteModalVisible(false);
    },
    onError: (err: unknown) => {
      let message = "Impossible d’envoyer l’invitation pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setInviteError(message);
      showToast(message, "error");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (member: EventMember) =>
      member.status === "pending"
        ? eventApi.removeInvitation(eventId, member.id)
        : eventApi.removeMember(eventId, member.id),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Membre retiré.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de retirer ce membre pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async (member: EventMember) =>
      eventApi.updateMemberRole(eventId, member.id, {
        role: member.role === "organizer" ? "member" : "organizer",
      }),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Rôle mis à jour.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de mettre à jour le rôle pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const transferAdminMutation = useMutation({
    mutationFn: async (member: EventMember) =>
      eventApi.transferAdmin(eventId, { memberId: member.id }),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Administrateur transféré.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de transférer l’administration pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const createOrUpdateStepMutation = useMutation({
    mutationFn: async (payload: { form: StepFormState; iso: string; editingStepId?: number }) => {
      const body: CreateStepPayload = {
        name: payload.form.name.trim(),
        description: payload.form.description.trim() || null,
        location: payload.form.location.trim() || null,
        scheduledTime: payload.iso,
      };

      if (payload.editingStepId) {
        await eventApi.updateStep(eventId, payload.editingStepId, body);
        return { message: "Étape mise à jour." };
      }
      await eventApi.createStep(eventId, body);
      return { message: "Étape ajoutée." };
    },
    onSuccess: async (data) => {
      await invalidateEvent();
      showToast(data.message, "success");
      closeStepModal();
    },
    onError: (err: unknown) => {
      let message = "Impossible d’enregistrer l’étape pour le moment.";
      if (err instanceof Error) {
        message = err.message;
      }
      setStepError(message);
      showToast(message, "error");
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: number) => eventApi.deleteStep(eventId, stepId),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Étape supprimée.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de supprimer l’étape pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    },
  });

  const loadJoinRequests = useCallback(async () => {
    if (!eventId) return;
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      const data = await eventApi.joinRequests(eventId);
      setJoinRequests(data);
    } catch (err) {
      let message = "Impossible de récupérer les demandes pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setRequestsError(message);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [eventId]);

  const acceptJoinRequestMutation = useMutation({
    mutationFn: async (requestId: number) =>
      eventApi.acceptJoinRequest(eventId, requestId),
    onSuccess: async (data, requestId) => {
      setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
      await invalidateEvent();
      showToast(
        data.message ??
          "Demande acceptée. Le membre est maintenant dans l’évènement.",
        "success",
      );
    },
    onError: (err: unknown) => {
      let message = "Impossible d’accepter la demande pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setRequestsError(message);
      showToast(message, "error");
    },
  });

  const declineJoinRequestMutation = useMutation({
    mutationFn: async (requestId: number) =>
      eventApi.declineJoinRequest(eventId, requestId),
    onSuccess: async (data, requestId) => {
      setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
      await invalidateEvent();
      showToast(data.message ?? "Demande refusée.", "success");
    },
    onError: (err: unknown) => {
      let message = "Impossible de refuser la demande pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setRequestsError(message);
      showToast(message, "error");
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (payload: CreateEventPayload) => eventApi.update(eventId, payload),
    onSuccess: async () => {
      await invalidateEvent();
      showToast("Évènement mis à jour.", "success");
      setIsEditEventModalVisible(false);
      setEventError(null);
    },
    onError: (err: unknown) => {
      let message = "Impossible de mettre à jour l’évènement pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setEventError(message);
      showToast(message, "error");
    },
  });

  const handleOpenMembersModal = () => {
    setIsMembersModalVisible(true);
  };

  const handleOpenInviteModal = () => {
    setInvitePhone("");
    setInviteError(null);
    setIsInviteModalVisible(true);
  };

  const handleOpenStepModal = (step?: EventStep) => {
    if (step) {
      const existingDate = new Date(step.scheduledTime);
      setEditingStep(step);
      setStepDate(Number.isNaN(existingDate.valueOf()) ? null : existingDate);
      setStepForm({
        name: step.name,
        description: step.description ?? "",
        location: step.location ?? "",
        scheduledTime: Number.isNaN(existingDate.valueOf()) ? "" : existingDate.toISOString(),
      });
    } else {
      setEditingStep(null);
      setStepDate(null);
      setStepForm({
        name: "",
        description: "",
        location: "",
        scheduledTime: "",
      });
    }
    setStepError(null);
    setIsStepModalVisible(true);
  };

  const handleOpenRequestsModal = () => {
    setIsRequestsModalVisible(true);
    void loadJoinRequests();
  };

  const handleOpenEditEventModal = () => {
    if (!event) return;
    setEventForm({
      name: event.name,
      description: event.description ?? "",
      location: event.location ?? "",
      startDate: toInputDateTime(event.startDate),
      endDate: toInputDateTime(event.endDate),
      isPaid: event.isPaid,
      price:
        event.isPaid && event.price != null ? String(event.price) : "",
    });
    setEventError(null);
    setPendingEventUpdate(null);
    setIsEditEventModalVisible(true);
  };

  const handleStepDateConfirm = (date: Date) => {
    setIsDateTimePickerVisible(false);
    setStepDate(date);
    setStepForm((prev) => ({ ...prev, scheduledTime: date.toISOString() }));
    setStepError(null);
  };

  const handleStepDateCancel = () => {
    setIsDateTimePickerVisible(false);
  };

  const closeStepModal = () => {
    setIsStepModalVisible(false);
    setIsDateTimePickerVisible(false);
    setStepError(null);
    setStepDate(null);
    setEditingStep(null);
    setStepForm({
      name: "",
      description: "",
      location: "",
      scheduledTime: "",
    });
  };

  const validateStepForm = () => {
    if (!stepForm.name.trim()) {
      return "Le nom de l’étape est obligatoire.";
    }
    if (!stepDate) {
      return "Merci de choisir la date et l’heure.";
    }
    return null;
  };

  const handleStepSubmit = () => {
    const validationError = validateStepForm();
    if (validationError) {
      setStepError(validationError);
      return;
    }

    if (!stepDate) {
      setStepError("Merci de choisir la date et l’heure.");
      return;
    }

    const iso = stepDate.toISOString();

    if (event) {
      const stepDateValue = new Date(iso);
      const eventStart = event.startDate ? new Date(event.startDate) : null;
      const eventEnd = event.endDate ? new Date(event.endDate) : null;

      if (eventStart && stepDateValue < eventStart) {
        setStepError("L’étape doit se situer après la date de début de l’évènement.");
        return;
      }
      if (eventEnd && stepDateValue > eventEnd) {
        setStepError("L’étape doit se situer avant la date de fin de l’évènement.");
        return;
      }
    }

    const updatedForm = {
      ...stepForm,
      scheduledTime: iso,
    };
    setStepForm(updatedForm);

    createOrUpdateStepMutation.mutate({
      form: updatedForm,
      iso,
      editingStepId: editingStep?.id,
    });
  };

  const validateEventForm = () => {
    if (!eventForm.name.trim()) {
      return "Le nom de l’évènement est obligatoire.";
    }
    const startIso = parseDateTimeInput(eventForm.startDate);
    const endIso = parseDateTimeInput(eventForm.endDate);
    if (!startIso || !endIso) {
      return "Merci d’indiquer des dates valides.";
    }
    if (new Date(endIso) < new Date(startIso)) {
      return "La date de fin doit être postérieure à la date de début.";
    }
    if (eventForm.isPaid) {
      const priceValue = Number(eventForm.price);
      if (!eventForm.price || Number.isNaN(priceValue) || priceValue < 0) {
        return "Merci d’indiquer un prix valide.";
      }
    }
    return null;
  };

  const handleEventSubmit = () => {
    const validationError = validateEventForm();
    if (validationError) {
      setEventError(validationError);
      return;
    }
    const payload: CreateEventPayload = {
      name: eventForm.name.trim(),
      description: eventForm.description.trim(),
      location: eventForm.location.trim(),
      startDate: parseDateTimeInput(eventForm.startDate)!,
      endDate: parseDateTimeInput(eventForm.endDate)!,
      isPaid: eventForm.isPaid,
      price: eventForm.isPaid ? Number(eventForm.price) : null,
    };

    if (event) {
      const nextStart = new Date(payload.startDate);
      const nextEnd = new Date(payload.endDate);
      const currentStart = new Date(event.startDate);
      const currentEnd = new Date(event.endDate);

      const startChanged = currentStart.getTime() !== nextStart.getTime();
      const endChanged = currentEnd.getTime() !== nextEnd.getTime();

      let affectedBefore = 0;
      let affectedAfter = 0;

      if (startChanged) {
        affectedBefore = event.steps.filter((step) => {
          const scheduled = new Date(step.scheduledTime);
          return !Number.isNaN(scheduled.valueOf()) && scheduled < nextStart;
        }).length;
      }

      if (endChanged) {
        affectedAfter = event.steps.filter((step) => {
          const scheduled = new Date(step.scheduledTime);
          return !Number.isNaN(scheduled.valueOf()) && scheduled > nextEnd;
        }).length;
      }

      if ((startChanged || endChanged) && (affectedBefore > 0 || affectedAfter > 0)) {
        setPendingEventUpdate({
          payload,
          affectedBefore,
          affectedAfter,
        });
        setIsUpdateConfirmationVisible(true);
        return;
      }
    }

    updateEventMutation.mutate(payload);
  };

  const handleConfirmEventUpdate = () => {
    if (!pendingEventUpdate) return;
    updateEventMutation.mutate(pendingEventUpdate.payload);
    setPendingEventUpdate(null);
    setIsUpdateConfirmationVisible(false);
  };

  const handleOpenStepDetail = (step: EventStep) => {
    setSelectedStep(step);
    setIsStepDetailModalVisible(true);
  };

  const handleCloseStepDetail = () => {
    setIsStepDetailModalVisible(false);
    setSelectedStep(null);
  };

  const renderStep = (step: EventStep) => (
    <Pressable
      key={step.id}
      style={({ pressed }) => [styles.stepCard, pressed && styles.cardPressed]}
      onPress={() => handleOpenStepDetail(step)}
    >
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle} numberOfLines={2} ellipsizeMode="tail">
          {step.name}
        </Text>
        {isOrganizer ? (
          <View style={styles.stepActions}>
            <Pressable
              style={styles.stepActionButton}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenStepModal(step);
              }}
              accessibilityLabel="Modifier l'étape"
            >
              <Ionicons name="pencil" size={16} color="#50E3C2" />
            </Pressable>
            <Pressable
              style={[styles.stepActionButton, styles.stepActionDelete]}
              onPress={(e) => {
                e.stopPropagation();
                Alert.alert(
                  "Supprimer l'étape",
                  "Cette action est définitive. Continuer ?",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: () => deleteStepMutation.mutate(step.id),
                    },
                  ],
                );
              }}
              accessibilityLabel="Supprimer l'étape"
            >
              <Ionicons name="trash-outline" size={16} color="#FF8888" />
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.stepMeta}>
        <Text style={styles.stepMetaItem}>📍 {step.location || "Lieu à définir"}</Text>
        <Text style={styles.stepMetaItem}>🕒 {formatDateTime(step.scheduledTime)}</Text>
      </View>
    </Pressable>
  );

  const renderMember = (member: EventMember) => {
    const fullName =
      `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || "Invité";
    const isCurrentUser = currentMember?.id === member.id;
    const canManageRole = isOrganizer && !isCurrentUser && member.status === "active";
    const canRemove =
      isOrganizer &&
      (!isCurrentUser &&
        (member.role !== "admin" ||
          (isAdmin && member.role !== "admin")));

    return (
      <View key={member.id} style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{fullName}</Text>
          <Text style={styles.memberRole}>
            {member.status === "pending"
              ? "Invitation en attente"
              : member.role === "admin"
                ? "Administrateur"
                : member.role === "organizer"
                  ? "Organisateur"
                  : "Membre"}
          </Text>
          {member.phone && member.showPhone ? (
            <Text style={styles.memberPhone}>📱 {member.phone}</Text>
          ) : null}
          {member.paymentStatus ? (
            <Text style={styles.memberPayment}>Statut: {member.paymentStatus}</Text>
          ) : null}
        </View>
        <View style={styles.memberActions}>
          {isAdmin && member.role !== "admin" && member.status === "active" ? (
            <Pressable
              style={styles.memberAction}
              onPress={() =>
                Alert.alert(
                  "Transférer l’administration",
                  `Confirmer le transfert de l’administration à ${fullName} ?`,
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Transférer",
                      onPress: () => transferAdminMutation.mutate(member),
                    },
                  ],
                )
              }
            >
              <Text style={styles.memberActionLabel}>Transférer admin</Text>
            </Pressable>
          ) : null}
          {canManageRole && member.role !== "admin" ? (
            <Pressable
              style={styles.memberAction}
              onPress={() => updateMemberRoleMutation.mutate(member)}
            >
              <Text style={styles.memberActionLabel}>
                {member.role === "organizer" ? "Retirer organisateur" : "Promouvoir"}
              </Text>
            </Pressable>
          ) : null}
          {canRemove ? (
            <Pressable
              style={[styles.memberAction, styles.memberActionDanger]}
              onPress={() =>
                Alert.alert(
                  member.status === "pending" ? "Supprimer l’invitation" : "Retirer le membre",
                  member.status === "pending"
                    ? "Confirmer la suppression de cette invitation ?"
                    : `Retirer ${fullName} de l’évènement ?`,
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Confirmer",
                      style: "destructive",
                      onPress: () => removeMemberMutation.mutate(member),
                    },
                  ],
                )
              }
            >
              <Text style={styles.memberActionLabel}>
                {member.status === "pending" ? "Supprimer inv." : "Retirer"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const renderJoinRequest = (request: EventJoinRequest) => {
    const fullName =
      `${request.firstName ?? ""} ${request.lastName ?? ""}`.trim() || "Demandeur";
    return (
      <View key={request.id} style={styles.requestCard}>
        <Text style={styles.requestName}>{fullName}</Text>
        {request.phone ? (
          <Text style={styles.requestInfo}>📱 {request.phone}</Text>
        ) : null}
        <View style={styles.requestActions}>
          <Pressable
            style={[styles.requestButton, styles.requestDecline]}
            onPress={() => declineJoinRequestMutation.mutate(request.id)}
            disabled={declineJoinRequestMutation.isPending || acceptJoinRequestMutation.isPending}
          >
            <Text style={styles.requestButtonLabel}>
              {declineJoinRequestMutation.isPending ? "Refus..." : "Refuser"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.requestButton, styles.requestAccept]}
            onPress={() => acceptJoinRequestMutation.mutate(request.id)}
            disabled={acceptJoinRequestMutation.isPending || declineJoinRequestMutation.isPending}
          >
            <Text style={[styles.requestButtonLabel, styles.requestButtonLabelAccent]}>
              {acceptJoinRequestMutation.isPending ? "Accept..." : "Accepter"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const handleLeaveEvent = () => {
    Alert.alert(
      "Quitter l’évènement",
      "Es-tu sûr de vouloir quitter cet évènement ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: () => leaveEventMutation.mutate(),
        },
      ],
    );
  };

  const renderAccessDenied = () => (
    <View style={styles.accessContainer}>
      <Stack.Screen
        options={{
          title: "Accès restreint",
        }}
      />
      <View style={styles.accessCard}>
        <Text style={styles.accessTitle}>Accès restreint</Text>
        <Text style={styles.accessSubtitle}>
          Tu ne fais pas partie de cet évènement. Tu peux demander à le rejoindre auprès des
          organisateurs.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => eventApi.requestJoin(eventId).then(() => showToast("Demande envoyée."))}
        >
          <Text style={styles.primaryButtonLabel}>Demander à rejoindre</Text>
        </Pressable>
      </View>
    </View>
  );

  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);

  const adminPhone = useMemo(() => {
    if (!event) return null;
    const adminMember = event.members.find((member) => member.userId === event.createdBy.id);
    if (!adminMember?.phone || !adminMember.showPhone) {
      return null;
    }
    return adminMember.phone;
  }, [event]);

  const stepDateLabel = stepDate ? formatDateTime(stepDate.toISOString()) : "Sélectionner la date et l’heure";
  const isStepSubmitDisabled =
    !stepForm.name.trim() ||
    !stepDate ||
    createOrUpdateStepMutation.isPending;

  if (!eventId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Identifiant d’évènement manquant.</Text>
      </View>
    );
  }

  if (accessDenied) {
    return renderAccessDenied();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: event ? event.name : "Évènement",
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {toast ? (
          <View
            style={[
              styles.toast,
              toast.variant === "error" ? styles.toastError : styles.toastSuccess,
            ]}
          >
            <Text
              style={[
                styles.toastText,
                toast.variant === "error" ? styles.toastTextError : styles.toastTextSuccess,
              ]}
            >
              {toast.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#50E3C2" />
              <Text style={styles.loadingText}>Chargement en cours…</Text>
            </View>
          ) : isError ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : event ? (
            <>
              <View style={styles.topActions}>
                <View style={styles.topButtonsRow}>
                  <Pressable style={styles.ghostButton} onPress={handleOpenMembersModal}>
                    <Text style={styles.ghostButtonLabel}>Membres</Text>
                  </Pressable>
                  {isOrganizer ? (
                    <>
                      <Pressable
                        style={styles.ghostButton}
                        onPress={handleOpenEditEventModal}
                      >
                        <Text style={styles.ghostButtonLabel}>Modifier</Text>
                      </Pressable>
                      <Pressable style={styles.ghostButton} onPress={handleOpenRequestsModal}>
                        <Text style={styles.ghostButtonLabel}>
                          Demandes ({pendingJoinRequests})
                        </Text>
                      </Pressable>
                      <Pressable style={styles.ghostButton} onPress={handleOpenInviteModal}>
                        <Text style={styles.ghostButtonLabel}>Inviter</Text>
                      </Pressable>
                      <Pressable
                        style={styles.primaryButton}
                        onPress={() => handleOpenStepModal()}
                      >
                        <Text style={styles.primaryButtonLabel}>Ajouter une étape</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable
                    style={[
                      styles.dangerButton,
                      (!canLeaveEvent || leaveEventMutation.isPending) && styles.disabledButton,
                    ]}
                    onPress={handleLeaveEvent}
                    disabled={!canLeaveEvent || leaveEventMutation.isPending}
                  >
                    <Text style={styles.dangerButtonLabel}>
                      {leaveEventMutation.isPending
                        ? "Départ..."
                        : canLeaveEvent
                          ? "Quitter"
                          : isAdmin
                            ? "Administrateur"
                            : "Dernier organisateur"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventDescription}>
                  {event.description || "Aucune description fournie."}
                </Text>
                <View style={styles.metaGrid}>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Début</Text>
                      <Text style={styles.metaValue}>{formatDateTime(event.startDate)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Fin</Text>
                      <Text style={styles.metaValue}>{formatDateTime(event.endDate)}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Lieu</Text>
                      <Text style={styles.metaValue}>{event.location || "Lieu à confirmer"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Administrateur</Text>
                      <Pressable
                        style={styles.metaButton}
                        onPress={() => setIsAdminModalVisible(true)}
                      >
                        <Text style={styles.metaValue}>{adminName || "Inconnu"}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              {currentMember ? (
                <View style={styles.preferenceCard}>
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceTitle}>Visibilité du numéro</Text>
                    <Text style={styles.preferenceSubtitle}>
                      {currentMember.showPhone
                        ? "Ton numéro est visible par les autres membres."
                        : "Ton numéro est masqué pour les autres membres."}
                    </Text>
                  </View>
                  <Switch
                    value={currentMember.showPhone}
                    onValueChange={() => togglePhoneVisibilityMutation.mutate()}
                    trackColor={{ false: "rgba(255,255,255,0.3)", true: "#50E3C2" }}
                    thumbColor="#ffffff"
                    disabled={togglePhoneVisibilityMutation.isPending}
                  />
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Programme</Text>
                  <Text style={styles.sectionSubtitle}>
                    Les étapes prévues pour cet évènement.
                  </Text>
                </View>
                {event.steps.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Aucune étape planifiée pour le moment.
                  </Text>
                ) : (
                  <View style={styles.stepsList}>{event.steps.map(renderStep)}</View>
                )}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={isMembersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsMembersModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsMembersModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Membres</Text>
              <Pressable onPress={() => setIsMembersModalVisible(false)}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {event?.members.map(renderMember)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isInviteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsInviteModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inviter un membre</Text>
              <Pressable onPress={() => setIsInviteModalVisible(false)}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                value={invitePhone}
                onChangeText={setInvitePhone}
                placeholder="+33600000000"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
                style={styles.input}
              />
              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => setIsInviteModalVisible(false)}
              >
                <Text style={styles.modalSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimary,
                  inviteMutation.isPending && styles.disabledButton,
                ]}
                onPress={() => inviteMutation.mutate(invitePhone.trim())}
                disabled={inviteMutation.isPending}
              >
                <Text style={styles.modalPrimaryLabel}>
                  {inviteMutation.isPending ? "Envoi..." : "Envoyer"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isAdminModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsAdminModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAdminModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Administrateur</Text>
              <Pressable onPress={() => setIsAdminModalVisible(false)}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            <View style={styles.adminInfo}>
              <Text style={styles.adminName}>{adminName || "Inconnu"}</Text>
              {adminPhone ? (
                <Text style={styles.adminPhone}>📱 {adminPhone}</Text>
              ) : (
                <Text style={styles.adminPhoneHint}>
                  Numéro non disponible ou masqué par l’administrateur.
                </Text>
              )}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => setIsAdminModalVisible(false)}
              >
                <Text style={styles.modalPrimaryLabel}>Compris</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isStepModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeStepModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeStepModal}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingStep ? "Modifier l’étape" : "Nouvelle étape"}
              </Text>
              <Pressable onPress={closeStepModal}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  value={stepForm.name}
                  onChangeText={(value) => setStepForm((prev) => ({ ...prev, name: value }))}
                  placeholder="Nom de l’étape"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  value={stepForm.description}
                  onChangeText={(value) =>
                    setStepForm((prev) => ({ ...prev, description: value }))
                  }
                  placeholder="Détails supplémentaires"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Lieu</Text>
                <TextInput
                  value={stepForm.location}
                  onChangeText={(value) => setStepForm((prev) => ({ ...prev, location: value }))}
                  placeholder="Lieu de l’étape"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date et heure</Text>
                <Pressable
                  style={[styles.input, styles.dateInput]}
                  onPress={() => setIsDateTimePickerVisible(true)}
                >
                  <Text
                    style={stepDate ? styles.dateInputLabel : styles.dateInputPlaceholder}
                  >
                    {stepDateLabel}
                  </Text>
                </Pressable>
              </View>
              {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}
            </ScrollView>
            <DateTimePickerModal
              isVisible={isDateTimePickerVisible}
              mode="datetime"
              date={
                stepDate ??
                (event?.startDate ? new Date(event.startDate) : new Date())
              }
              locale="fr-FR"
              minuteInterval={5}
              onConfirm={handleStepDateConfirm}
              onCancel={handleStepDateCancel}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={closeStepModal}
              >
                <Text style={styles.modalSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimary,
                  isStepSubmitDisabled && styles.disabledButton,
                ]}
                onPress={handleStepSubmit}
                disabled={isStepSubmitDisabled}
              >
                <Text style={styles.modalPrimaryLabel}>
                  {createOrUpdateStepMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isStepDetailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseStepDetail}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseStepDetail}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={0}>
                {selectedStep?.name || "Détails de l'étape"}
              </Text>
              <Pressable
                onPress={handleCloseStepDetail}
                style={styles.closeIconButton}
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {selectedStep?.description ? (
                <View style={styles.stepDetailSection}>
                  <View style={styles.stepDetailSectionHeader}>
                    <Ionicons name="document-text-outline" size={20} color="rgba(80, 227, 194, 0.7)" />
                    <Text style={styles.stepDetailSectionTitle}>Description</Text>
                  </View>
                  <Text style={styles.stepDetailText}>{selectedStep.description}</Text>
                </View>
              ) : null}
              <View style={styles.stepDetailSection}>
                <View style={styles.stepDetailSectionHeader}>
                  <Ionicons name="location-outline" size={20} color="rgba(80, 227, 194, 0.7)" />
                  <Text style={styles.stepDetailSectionTitle}>Lieu</Text>
                </View>
                <Text style={styles.stepDetailText}>
                  {selectedStep?.location || "Lieu à définir"}
                </Text>
              </View>
              <View style={styles.stepDetailSection}>
                <View style={styles.stepDetailSectionHeader}>
                  <Ionicons name="time-outline" size={20} color="rgba(80, 227, 194, 0.7)" />
                  <Text style={styles.stepDetailSectionTitle}>Date et heure</Text>
                </View>
                <Text style={styles.stepDetailText}>
                  {selectedStep?.scheduledTime
                    ? formatDateTime(selectedStep.scheduledTime)
                    : "Non définie"}
                </Text>
              </View>
            </ScrollView>
            {isOrganizer && selectedStep ? (
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSecondary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    handleCloseStepDetail();
                    handleOpenStepModal(selectedStep);
                  }}
                >
                  <Text style={styles.modalSecondaryLabel}>Modifier</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalDelete,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    handleCloseStepDetail();
                    Alert.alert(
                      "Supprimer l'étape",
                      "Cette action est définitive. Continuer ?",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: () => deleteStepMutation.mutate(selectedStep.id),
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.modalDeleteLabel}>Supprimer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalPrimary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCloseStepDetail}
                >
                  <Text style={styles.modalPrimaryLabel}>Fermer</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isRequestsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsRequestsModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsRequestsModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Demandes à valider</Text>
              <Pressable onPress={() => setIsRequestsModalVisible(false)}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            {isLoadingRequests ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#50E3C2" />
                <Text style={styles.loadingText}>Chargement des demandes…</Text>
              </View>
            ) : requestsError ? (
              <Text style={styles.errorText}>{requestsError}</Text>
            ) : joinRequests.length === 0 ? (
              <Text style={styles.emptyText}>Aucune demande en attente.</Text>
            ) : (
              <ScrollView style={styles.modalScroll}>
                {joinRequests.map(renderJoinRequest)}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isEditEventModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditEventModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditEventModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l’évènement</Text>
              <Pressable onPress={() => setIsEditEventModalVisible(false)}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  value={eventForm.name}
                  onChangeText={(value) => setEventForm((prev) => ({ ...prev, name: value }))}
                  style={styles.input}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  value={eventForm.description}
                  onChangeText={(value) =>
                    setEventForm((prev) => ({ ...prev, description: value }))
                  }
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Lieu</Text>
                <TextInput
                  value={eventForm.location}
                  onChangeText={(value) => setEventForm((prev) => ({ ...prev, location: value }))}
                  style={styles.input}
                />
              </View>
              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Début (YYYY-MM-DD HH:mm)</Text>
                  <TextInput
                    value={eventForm.startDate}
                    onChangeText={(value) =>
                      setEventForm((prev) => ({ ...prev, startDate: value }))
                    }
                    style={styles.input}
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Fin (YYYY-MM-DD HH:mm)</Text>
                  <TextInput
                    value={eventForm.endDate}
                    onChangeText={(value) =>
                      setEventForm((prev) => ({ ...prev, endDate: value }))
                    }
                    style={styles.input}
                  />
                </View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Évènement payant</Text>
                <Switch
                  value={eventForm.isPaid}
                  onValueChange={(value) =>
                    setEventForm((prev) => ({
                      ...prev,
                      isPaid: value,
                      price: value ? prev.price : "",
                    }))
                  }
                  trackColor={{ false: "rgba(255,255,255,0.3)", true: "#50E3C2" }}
                  thumbColor="#ffffff"
                />
              </View>
              {eventForm.isPaid ? (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Prix (€)</Text>
                  <TextInput
                    value={eventForm.price}
                    onChangeText={(value) => setEventForm((prev) => ({ ...prev, price: value }))}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              ) : null}
              {eventError ? <Text style={styles.errorText}>{eventError}</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => setIsEditEventModalVisible(false)}
              >
                <Text style={styles.modalSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimary,
                  updateEventMutation.isPending && styles.disabledButton,
                ]}
                onPress={handleEventSubmit}
                disabled={updateEventMutation.isPending}
              >
                <Text style={styles.modalPrimaryLabel}>
                  {updateEventMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isUpdateConfirmationVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsUpdateConfirmationVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsUpdateConfirmationVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(evt) => evt.stopPropagation()}>
            <Text style={styles.modalTitle}>Confirmation requise</Text>
            {pendingEventUpdate ? (
              <>
                <Text style={styles.confirmText}>
                  Certaines étapes se trouveront en dehors du nouveau créneau. Confirme la
                  mise à jour.
                </Text>
                <Text style={styles.confirmText}>
                  {pendingEventUpdate.affectedBefore} étape(s) avant la nouvelle date de début.
                </Text>
                <Text style={styles.confirmText}>
                  {pendingEventUpdate.affectedAfter} étape(s) après la nouvelle date de fin.
                </Text>
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => setIsUpdateConfirmationVisible(false)}
              >
                <Text style={styles.modalSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={handleConfirmEventUpdate}>
                <Text style={styles.modalPrimaryLabel}>Confirmer</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0C1B33",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },
  card: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 24,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
  },
  errorText: {
    color: "#FFB5B5",
    fontSize: 14,
  },
  topActions: {
    gap: 12,
  },
  topButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#50E3C2",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: "#0C1B33",
    fontWeight: "700",
  },
  dangerButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#FF8888",
  },
  dangerButtonLabel: {
    color: "#FFAAAA",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  section: {
    gap: 16,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eventDescription: {
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
  metaGrid: {
    gap: 12,
  },
  metaItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textTransform: "uppercase",
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  metaButton: {
    paddingVertical: 4,
  },
  preferenceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
  },
  preferenceText: {
    gap: 4,
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  preferenceSubtitle: {
    color: "rgba(255,255,255,0.7)",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "rgba(255,255,255,0.65)",
  },
  stepsList: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  stepActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  stepActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(80, 227, 194, 0.4)",
    backgroundColor: "rgba(80, 227, 194, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepActionLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  stepActionDelete: {
    borderColor: "rgba(255, 136, 136, 0.4)",
    backgroundColor: "rgba(255, 136, 136, 0.15)",
  },
  stepDescription: {
    color: "rgba(255,255,255,0.75)",
  },
  stepMeta: {
    gap: 4,
  },
  stepMetaItem: {
    color: "rgba(255,255,255,0.7)",
  },
  stepDetailSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  stepDetailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  stepDetailSectionTitle: {
    color: "rgba(80, 227, 194, 0.75)",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepDetailText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 24,
    paddingLeft: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12, 27, 51, 0.8)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "rgba(12, 27, 51, 0.95)",
    borderRadius: 24,
    padding: 20,
    maxHeight: "90%",
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(80, 227, 194, 0.18)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: -4,
  },
  closeButton: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  modalScroll: {
    maxHeight: 400,
  },
  formGroup: {
    gap: 6,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formGroupHalf: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dateInput: {
    justifyContent: "center",
  },
  dateInputLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dateInputPlaceholder: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  modalSecondaryLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#50E3C2",
  },
  modalPrimaryLabel: {
    color: "#0C1B33",
    fontWeight: "700",
  },
  modalDelete: {
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalDeleteLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  memberCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  memberInfo: {
    gap: 4,
  },
  memberName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  memberRole: {
    color: "rgba(255,255,255,0.6)",
  },
  memberPhone: {
    color: "rgba(255,255,255,0.75)",
  },
  memberPayment: {
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  memberAction: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberActionDanger: {
    borderColor: "#D64545",
  },
  memberActionLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  invitationCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  invitationHeader: {
    gap: 4,
  },
  invitationTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  invitationDate: {
    color: "rgba(255,255,255,0.7)",
  },
  invitationInviter: {
    color: "rgba(255,255,255,0.75)",
  },
  invitationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  invitationDecline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invitationAccept: {
    backgroundColor: "#50E3C2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invitationDeclineLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  invitationAcceptLabel: {
    color: "#0C1B33",
    fontWeight: "700",
  },
  invitationList: {
    gap: 12,
  },
  invitationsCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  invitationsHeader: {
    gap: 8,
  },
  invitationsTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  invitationsSubtitle: {
    color: "rgba(255,255,255,0.65)",
  },
  emptyInvitation: {
    color: "rgba(255,255,255,0.65)",
  },
  requestCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  requestName: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  requestInfo: {
    color: "rgba(255,255,255,0.7)",
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  requestButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  requestDecline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  requestAccept: {
    backgroundColor: "#50E3C2",
  },
  requestButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  requestButtonLabelAccent: {
    color: "#0C1B33",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toast: {
    borderRadius: 12,
    padding: 12,
  },
  toastSuccess: {
    backgroundColor: "rgba(80, 227, 194, 0.15)",
  },
  toastError: {
    backgroundColor: "rgba(214, 69, 69, 0.18)",
  },
  toastText: {
    fontWeight: "600",
    textAlign: "center",
  },
  toastTextSuccess: {
    color: "#9CF2DE",
  },
  toastTextError: {
    color: "#FFD3D3",
  },
  accessContainer: {
    flex: 1,
    backgroundColor: "#0C1B33",
    padding: 24,
    justifyContent: "center",
  },
  accessCard: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  accessTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  accessSubtitle: {
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
  confirmText: {
    color: "rgba(255,255,255,0.85)",
  },
  emptyText: {
    color: "rgba(255,255,255,0.65)",
  },
  adminInfo: {
    gap: 8,
    marginBottom: 12,
  },
  adminName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  adminPhone: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 16,
  },
  adminPhoneHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontStyle: "italic",
  },
});

