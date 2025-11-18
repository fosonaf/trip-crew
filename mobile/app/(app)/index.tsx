import { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "@/hooks/use-auth";
import { eventApi } from "@/api/events";
import { invitationApi } from "@/api/invitations";
import type { EventSummary, PendingInvitation } from "@/types/event";

export default function AppHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinEventId, setJoinEventId] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: eventApi.list,
  });

  const pendingInvitationsQuery = useQuery({
    queryKey: ["invitations", "pending"],
    queryFn: invitationApi.pending,
  });

  const leaveMutation = useMutation({
    mutationFn: (eventId: number) => eventApi.leave(eventId),
    onSuccess: async () => {
      setFeedback("Tu as quitté l’évènement.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de quitter l’évènement pour le moment.";
      setFeedback(message);
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (eventId: string) => eventApi.requestJoin(eventId),
    onSuccess: (data) => {
      setJoinSuccess(data.message);
      setJoinError(null);
      setJoinEventId("");
    },
    onError: (err) => {
      let message = "Impossible d’envoyer la demande pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setJoinError(message);
      setJoinSuccess(null);
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: (memberId: number) => invitationApi.accept(memberId),
    onSuccess: async (data) => {
      setFeedback(data.message ?? "Invitation acceptée !");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invitations", "pending"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      let message = "Impossible d’accepter l’invitation pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setFeedback(message);
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: (memberId: number) => invitationApi.decline(memberId),
    onSuccess: async (data) => {
      setFeedback(data.message ?? "Invitation refusée.");
      await queryClient.invalidateQueries({ queryKey: ["invitations", "pending"] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      let message = "Impossible de refuser l’invitation pour le moment.";
      if (isAxiosError(err)) {
        const data = err.response?.data as { message?: string; error?: string } | undefined;
        message = data?.message ?? data?.error ?? message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setFeedback(message);
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const openJoinModal = () => {
    setJoinModalVisible(true);
    setJoinEventId("");
    setJoinError(null);
    setJoinSuccess(null);
  };

  const closeJoinModal = () => {
    if (joinMutation.isPending) return;
    setJoinModalVisible(false);
  };

  const handleJoin = () => {
    if (!joinEventId.trim()) {
      setJoinError("Merci d’indiquer l’identifiant de l’évènement.");
      setJoinSuccess(null);
      return;
    }
    setJoinError(null);
    setJoinSuccess(null);
    joinMutation.mutate(joinEventId.trim());
  };

  const formatName = useMemo(() => {
    if (!user?.firstName) {
      return "Trip Crew";
    }
    return user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase();
  }, [user?.firstName]);

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

  const renderEventCard = (event: EventSummary) => (
    <Pressable
      key={event.id}
      style={({ pressed }) => [styles.eventCard, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(app)/events/${event.id}`)}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{event.name}</Text>
        {event.role === "admin" || event.role === "organizer" ? (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeLabel}>
              {event.role === "admin" ? "Administrateur" : "Organisateur"}
            </Text>
          </View>
        ) : null}
      </View>
      {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
      <View style={styles.eventMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Début</Text>
          <Text style={styles.metaValue}>{formatDateTime(event.startDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Fin</Text>
          <Text style={styles.metaValue}>{formatDateTime(event.endDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Lieu</Text>
          <Text style={styles.metaValue}>{event.location || "Non précisé"}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Tarif</Text>
          <Text style={styles.metaValue}>
            {event.isPaid
              ? `${event.price?.toLocaleString("fr-FR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })} €`
              : "Gratuit"}
          </Text>
        </View>
      </View>
      <Pressable
        style={[
          styles.leaveButton,
          (event.role === "admin" ||
            (event.role === "organizer" && event.organizerCount <= 1) ||
            leaveMutation.isPending) &&
            styles.disabledButton,
        ]}
        onPress={() => leaveMutation.mutate(event.id)}
        disabled={
          event.role === "admin" ||
          (event.role === "organizer" && event.organizerCount <= 1) ||
          leaveMutation.isPending
        }
      >
        <Text style={styles.leaveButtonLabel}>
          {event.role === "admin"
            ? "Administrateur"
            : event.role === "organizer" && event.organizerCount <= 1
              ? "Dernier organisateur"
              : leaveMutation.isPending
                ? "Départ..."
                : "Quitter l’évènement"}
        </Text>
      </Pressable>
    </Pressable>
  );

  const renderInvitationCard = (invitation: PendingInvitation) => (
    <View key={invitation.memberId} style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <Text style={styles.invitationTitle}>{invitation.eventName}</Text>
        {invitation.startDate ? (
          <Text style={styles.invitationDate}>
            Début le {formatDateTime(invitation.startDate)}
          </Text>
        ) : null}
      </View>
      {invitation.inviter ? (
        <Text style={styles.invitationInviter}>
          Invité par <Text style={styles.accent}>{invitation.inviter}</Text>
        </Text>
      ) : null}
      <View style={styles.invitationActions}>
        <Pressable
          style={({ pressed }) => [
            styles.invitationDecline,
            (declineInvitationMutation.isPending || acceptInvitationMutation.isPending) &&
              styles.disabledButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => declineInvitationMutation.mutate(invitation.memberId)}
          disabled={declineInvitationMutation.isPending || acceptInvitationMutation.isPending}
        >
          <Text style={styles.invitationDeclineLabel}>
            {declineInvitationMutation.isPending ? "Refus..." : "Refuser"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.invitationAccept,
            (acceptInvitationMutation.isPending || declineInvitationMutation.isPending) &&
              styles.disabledButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => acceptInvitationMutation.mutate(invitation.memberId)}
          disabled={acceptInvitationMutation.isPending || declineInvitationMutation.isPending}
        >
          <Text style={styles.invitationAcceptLabel}>
            {acceptInvitationMutation.isPending ? "Accept..." : "Accepter"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Accueil",
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.greeting}>
            Bienvenue <Text style={styles.accent}>{formatName}</Text> 👋
          </Text>
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          <Text style={styles.heroSubtitle}>
            Prépare ton prochain voyage en invitant ton équipe, planifie chaque étape et reste
            synchronisé avec le chat temps réel.
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [
                styles.buttonWrapper,
                pressed && styles.buttonWrapperPressed,
              ]}
              onPress={() => router.push("/(app)/events/new")}
            >
              {({ pressed }) => (
                <View style={[styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                  <View style={styles.buttonContent}>
                    <Ionicons name="add-circle-outline" size={20} color="#50E3C2" />
                    <Text style={styles.primaryButtonLabel}>Créer un événement</Text>
                  </View>
                </View>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.buttonWrapper,
                pressed && styles.buttonWrapperPressed,
              ]}
              onPress={openJoinModal}
            >
              {({ pressed }) => (
                <View style={[styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
                  <View style={styles.buttonContent}>
                    <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.secondaryButtonLabel}>Rejoindre un événement</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {pendingInvitationsQuery.isLoading ||
        pendingInvitationsQuery.isError ||
        (pendingInvitationsQuery.data && pendingInvitationsQuery.data.length > 0) ? (
          <View style={styles.invitationsCard}>
            <View style={styles.invitationsHeader}>
              <Text style={styles.invitationsTitle}>Tes invitations</Text>
              <Text style={styles.invitationsSubtitle}>
                Accepte ou refuse les invitations reçues pour rejoindre un évènement.
              </Text>
            </View>
            {pendingInvitationsQuery.isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color="#50E3C2" />
                <Text style={styles.loadingText}>Chargement des invitations…</Text>
              </View>
            ) : pendingInvitationsQuery.isError ? (
              <Text style={styles.errorText}>
                {pendingInvitationsQuery.error instanceof Error
                  ? pendingInvitationsQuery.error.message
                  : "Impossible de récupérer tes invitations pour le moment."}
              </Text>
            ) : pendingInvitationsQuery.data && pendingInvitationsQuery.data.length > 0 ? (
              <View style={styles.invitationList}>
                {pendingInvitationsQuery.data.map(renderInvitationCard)}
              </View>
            ) : (
              <Text style={styles.emptyInvitation}>Aucune invitation en attente.</Text>
            )}
          </View>
        ) : null}

        <View style={[styles.eventsCard, styles.eventsCardTight]}>
          <View style={styles.eventsHeader}>
            <View style={styles.eventsHeaderText}>
              <Text style={styles.eventsTitle}>
                {eventsQuery.isLoading ? (
                  "Tes évènements"
                ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
                  <>
                    <Text style={styles.eventsTitleAccent}>{eventsQuery.data.length}</Text>
                    <Text> {eventsQuery.data.length === 1 ? "évènement" : "évènements"}</Text>
                  </>
                ) : (
                  "Aucun évènement"
                )}
              </Text>
              <Text style={styles.eventsSubtitle}>
                Tous les voyages auxquels tu participes, en tant qu'organisateur ou membre.
              </Text>
            </View>
          </View>

          {eventsQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#50E3C2" />
              <Text style={styles.loadingText}>Chargement en cours…</Text>
            </View>
          ) : eventsQuery.isError ? (
            <Text style={styles.errorText}>
              {eventsQuery.error instanceof Error
                ? eventsQuery.error.message
                : "Impossible de récupérer tes évènements pour le moment."}
            </Text>
          ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
            <View style={styles.eventsList}>{eventsQuery.data.map(renderEventCard)}</View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Tu n’as encore rejoint aucun évènement. Lance-toi en créant le premier !
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                onPress={() => router.push("/(app)/events/new")}
              >
                <Text style={styles.primaryButtonLabel}>Nouveau évènement</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={joinModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeJoinModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeJoinModal}>
          <Pressable style={styles.modalContent} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Rejoindre un évènement</Text>
            <Text style={styles.modalSubtitle}>
              Demande envoyée uniquement si l’évènement existe et que tu n’en fais pas encore partie.
            </Text>
            <TextInput
              value={joinEventId}
              onChangeText={setJoinEventId}
              placeholder="Identifiant (ex : 123)"
              placeholderTextColor="rgba(12,27,51,0.4)"
              keyboardType="number-pad"
              style={styles.modalInput}
              editable={!joinMutation.isPending}
            />
            {joinError ? <Text style={styles.modalError}>{joinError}</Text> : null}
            {joinSuccess ? <Text style={styles.modalSuccess}>{joinSuccess}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalSecondary, pressed && styles.buttonPressed]}
                onPress={closeJoinModal}
                disabled={joinMutation.isPending}
              >
                <Text style={styles.modalSecondaryLabel}>Annuler</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalPrimary,
                  joinMutation.isPending && styles.disabledButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleJoin}
                disabled={joinMutation.isPending}
              >
                <Text style={styles.modalPrimaryLabel}>
                  {joinMutation.isPending ? "Envoi..." : "Envoyer la demande"}
                </Text>
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
    gap: 16,
  },
  heroCard: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    gap: 16,
    marginBottom: 0,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  accent: {
    color: "#50E3C2",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
    minWidth: 160,
  },
  buttonWrapperPressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    backgroundColor: "rgba(80, 227, 194, 0.3)",
    borderWidth: 1.5,
    borderColor: "rgba(80, 227, 194, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "stretch",
    justifyContent: "center",
    shadowColor: "rgba(80, 227, 194, 0.6)",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 0,
  },
  primaryButtonPressed: {
    backgroundColor: "rgba(80, 227, 194, 0.4)",
    borderColor: "rgba(80, 227, 194, 0.8)",
    transform: [{ translateY: 2 }],
    shadowRadius: 1,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  primaryButtonLabel: {
    color: "#50E3C2",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "stretch",
    justifyContent: "center",
    shadowColor: "rgba(255, 255, 255, 0.4)",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 0,
  },
  secondaryButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.6)",
    transform: [{ translateY: 2 }],
    shadowRadius: 1,
  },
  secondaryButtonLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  feedback: {
    backgroundColor: "rgba(80, 227, 194, 0.12)",
    borderRadius: 12,
    padding: 12,
    color: "#9CF2DE",
    fontWeight: "600",
  },
  eventsCard: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 24,
    padding: 24,
    paddingRight: 24,
    gap: 20,
    overflow: "hidden",
  },
  eventsCardTight: {
    marginTop: -8,
  },
  eventsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  eventsHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  eventsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eventsTitleAccent: {
    color: "rgba(80, 227, 194, 0.9)",
  },
  eventsSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
  },
  counter: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(80, 227, 194, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexShrink: 0,
    marginRight: 0,
  },
  counterLabel: {
    color: "#50E3C2",
    fontSize: 18,
    fontWeight: "700",
  },
  loading: {
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
  },
  errorText: {
    color: "#FFB5B5",
    fontSize: 14,
  },
  eventsList: {
    gap: 16,
  },
  eventCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.8,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(80, 227, 194, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50E3C2",
  },
  badgeLabel: {
    color: "#50E3C2",
    fontSize: 12,
    fontWeight: "600",
  },
  eventDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  eventMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    width: "48%",
    gap: 4,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  leaveButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  leaveButtonLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  empty: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12, 27, 51, 0.8)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0C1B33",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(12,27,51,0.6)",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "rgba(12,27,51,0.16)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0C1B33",
  },
  modalError: {
    color: "#D64545",
    fontSize: 14,
  },
  modalSuccess: {
    color: "#2E9C6A",
    fontSize: 14,
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
    backgroundColor: "rgba(12,27,51,0.08)",
  },
  modalSecondaryLabel: {
    color: "#0C1B33",
    fontWeight: "600",
  },
  modalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#0C1B33",
  },
  modalPrimaryLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  invitationsCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  invitationsHeader: {
    gap: 8,
  },
  invitationsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  invitationsSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
  },
  invitationList: {
    gap: 12,
  },
  emptyInvitation: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
  },
  invitationCard: {
    backgroundColor: "rgba(12, 27, 51, 0.6)",
    borderRadius: 16,
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
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },
  invitationInviter: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  invitationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  invitationDecline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  invitationAccept: {
    backgroundColor: "#50E3C2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  invitationDeclineLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  invitationAcceptLabel: {
    color: "#0C1B33",
    fontWeight: "700",
  },
});

