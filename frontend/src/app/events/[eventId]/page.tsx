"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { ApiError, eventApi } from "@/lib/api";
import type {
  CreateEventPayload,
  CreateStepPayload,
  EventDetail,
  EventMember,
  EventStep,
} from "@/types/event";
import styles from "./page.module.css";

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Date inconnue";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
};

const formatPrice = (isPaid: boolean, price: number | null) => {
  if (!isPaid) {
    return "Gratuit";
  }
  if (price == null) {
    return "À définir";
  }
  return `${price.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} €`;
};

const toDateTimeLocalValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function EventDetailPage() {
  const { token, user, isHydrated } = useAuthContext();
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId ?? "";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<{ id: number; action: "accept" | "decline" } | null>(null);
  const [editingStep, setEditingStep] = useState<EventStep | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState<number | null>(null);
  const [isEventUpdateConfirmationOpen, setIsEventUpdateConfirmationOpen] = useState(false);
  const [pendingEventUpdate, setPendingEventUpdate] = useState<{
    payload: CreateEventPayload;
    affectedBefore: number;
    affectedAfter: number;
  } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [joinRequestMessage, setJoinRequestMessage] = useState<string | null>(null);
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [stepForm, setStepForm] = useState({
    name: "",
    description: "",
    location: "",
    scheduledTime: "",
  });
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    isPaid: false,
    price: "",
  });
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const fetchEvent = useCallback(
    async (withSpinner = false) => {
      if (!eventId) {
        return;
      }

      if (withSpinner) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const data = await eventApi.detail(eventId);
        setEvent(data);
        setError(null);
        setAccessDenied(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
          setError(null);
        } else {
          const message =
            err instanceof Error ? err.message : "Impossible de charger le détail de l’évènement.";
          setError(message);
        }
      } finally {
        if (withSpinner) {
          setIsLoading(false);
        }
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (!isHydrated || !token) {
      return;
    }

    fetchEvent(true);
  }, [isHydrated, token, fetchEvent]);

  const adminName = useMemo(() => {
    if (!event) return "";
    return `${event.createdBy.firstName} ${event.createdBy.lastName}`.trim();
  }, [event]);

  const currentMember = useMemo(() => {
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

  const isOrganizer =
    currentMember?.role === "organizer" || currentMember?.role === "admin";
  const isAdmin = event && user ? event.createdBy.id === user.id : false;

  const pendingJoinRequests = useMemo(() => {
    if (!event) return 0;
    if (Array.isArray(event.joinRequests)) {
      return event.joinRequests.length;
    }
    return event.joinRequestCount ?? 0;
  }, [event]);

  const eventUpdateConfirmationDetails = useMemo(() => {
    if (!pendingEventUpdate) {
      return null;
    }

    const { payload, affectedBefore, affectedAfter } = pendingEventUpdate;
    const startLabel = formatDateTime(payload.startDate);
    const endLabel = formatDateTime(payload.endDate);

    const items: string[] = [];

    if (affectedBefore > 0) {
      items.push(
        `${affectedBefore} étape${affectedBefore > 1 ? "s" : ""} seront déplacées à la nouvelle date de début.`,
      );
    }

    if (affectedAfter > 0) {
      items.push(
        `${affectedAfter} étape${affectedAfter > 1 ? "s" : ""} seront déplacées à la nouvelle date de fin.`,
      );
    }

    return {
      startLabel,
      endLabel,
      items,
    };
  }, [pendingEventUpdate]);

  const fetchJoinRequests = useCallback(async () => {
    if (!eventId || !isOrganizer) {
      return;
    }

    setIsLoadingRequests(true);
    setRequestsError(null);

    try {
      const requests = await eventApi.joinRequests(eventId);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              joinRequests: requests,
              joinRequestCount: requests.length,
            }
          : prev,
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de récupérer les demandes pour le moment.";
      setRequestsError(message);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [eventId, isOrganizer]);

  const canLeaveEvent = useMemo(() => {
    if (!currentMember) return false;
    if (currentMember.status !== "active") {
      return false;
    }
    if (isAdmin) {
      return false;
    }
    if (currentMember.role === "organizer" && activeOrganizerCount <= 1) {
      return false;
    }
    return true;
  }, [currentMember, activeOrganizerCount, isAdmin]);

  const leaveButtonLabel = useMemo(() => {
    if (isAdmin) {
      return "Administrateur";
    }
    if (currentMember?.role === "organizer" && activeOrganizerCount <= 1) {
      return "Dernier organisateur";
    }
    return isLeaving ? "Départ..." : "Quitter l’évènement";
  }, [currentMember, activeOrganizerCount, isLeaving, isAdmin]);

  const handleStepFieldChange = (
    evt: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = evt.target;
    setStepForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetStepForm = () => {
    setStepForm({
      name: "",
      description: "",
      location: "",
      scheduledTime: "",
    });
    setStepError(null);
    setEditingStep(null);
  };

  const handleInviteInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInvitePhone(event.target.value);
  };

  const openInviteModal = () => {
    setInvitePhone("");
    setInviteError(null);
    setIsInviteModalOpen(true);
  };

  const openCreateStepModal = () => {
    resetStepForm();
    setIsStepModalOpen(true);
  };

  const openEditEventModal = () => {
    if (!event) return;
    setEventForm({
      name: event.name,
      description: event.description ?? "",
      location: event.location ?? "",
      startDate: toDateTimeLocalValue(event.startDate),
      endDate: toDateTimeLocalValue(event.endDate),
      isPaid: event.isPaid,
      price: event.isPaid && event.price != null ? String(event.price) : "",
    });
    setEventFormError(null);
    setPendingEventUpdate(null);
    setIsEventUpdateConfirmationOpen(false);
    setIsEditEventModalOpen(true);
  };

  const closeEditEventModal = () => {
    if (isUpdatingEvent) return;
    setIsEditEventModalOpen(false);
    setEventFormError(null);
    setPendingEventUpdate(null);
    setIsEventUpdateConfirmationOpen(false);
  };

  const openRequestsModal = () => {
    setRequestsError(null);
    setIsRequestsModalOpen(true);
    void fetchJoinRequests();
  };

  const closeRequestsModal = () => {
    setIsRequestsModalOpen(false);
    setRequestsError(null);
    setProcessingRequest(null);
  };

  const closeStepModal = useCallback(() => {
    setIsStepModalOpen(false);
  }, []);

  const handleCancelStep = () => {
    resetStepForm();
    closeStepModal();
  };

  const closeMembersModal = () => {
    setIsMembersModalOpen(false);
  };

  const handleStepSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!event || !eventId) return;

    if (!stepForm.name.trim()) {
      setStepError("Le nom de l’étape est obligatoire.");
      return;
    }
    if (!stepForm.scheduledTime) {
      setStepError("Merci d’indiquer la date et l’heure de l’étape.");
      return;
    }

    const stepDate = new Date(stepForm.scheduledTime);
    if (Number.isNaN(stepDate.getTime())) {
      setStepError("La date et l’heure de l’étape sont invalides.");
      return;
    }

    const eventStartDate = event.startDate ? new Date(event.startDate) : null;
    const eventEndDate = event.endDate ? new Date(event.endDate) : null;

    if (
      (eventStartDate && stepDate < eventStartDate) ||
      (eventEndDate && stepDate > eventEndDate)
    ) {
      setStepError("L’étape doit se situer dans le créneau de l’évènement.");
      return;
    }

    const payload: CreateStepPayload = {
      name: stepForm.name.trim(),
      description: stepForm.description.trim() || null,
      location: stepForm.location.trim() || null,
      scheduledTime: new Date(stepForm.scheduledTime).toISOString(),
    };

    setIsSubmittingStep(true);
    setStepError(null);

    try {
      if (editingStep) {
        await eventApi.updateStep(eventId, editingStep.id, payload);
        await fetchEvent(false);
        setToast({ message: "Étape mise à jour.", variant: "success" });
      } else {
        const newStep = await eventApi.createStep(eventId, payload);
        setEvent((prev) =>
          prev
            ? {
                ...prev,
                steps: [...prev.steps, newStep].sort(
                  (a, b) =>
                    new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime(),
                ),
              }
            : prev,
        );
        setToast({ message: "Étape ajoutée avec succès.", variant: "success" });
      }
      resetStepForm();
      setIsStepModalOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible d’ajouter l’étape pour le moment.";
      setStepError(message);
      setToast({
        message:
          err instanceof Error ? err.message : "Impossible d’ajouter l’étape pour le moment.",
        variant: "error",
      });
    } finally {
      setIsSubmittingStep(false);
      setEditingStep(null);
    }
  };

  const handleInviteCancel = () => {
    setInvitePhone("");
    setInviteError(null);
    setIsInviteModalOpen(false);
  };

  const handleInviteSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setInviteError(null);

    if (!invitePhone.trim()) {
      setInviteError("Merci de renseigner le numéro de téléphone du membre à inviter.");
      return;
    }

    setIsSendingInvitation(true);

    try {
      await eventApi.invite(eventId, { phone: invitePhone.trim() });
      await fetchEvent(false);
      setToast({ message: "Invitation envoyée.", variant: "success" });
      handleInviteCancel();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible d’envoyer l’invitation pour le moment.";
      setInviteError(message);
      setToast({
        message,
        variant: "error",
      });
    } finally {
      setIsSendingInvitation(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await eventApi.removeMember(eventId, memberId);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((member) => member.id !== memberId),
            }
          : prev,
      );
      setToast({ message: "Membre retiré de l’évènement.", variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de retirer ce membre pour le moment.";
      setToast({ message, variant: "error" });
    }
  };

  const handleToggleOrganizerRole = async (member: EventMember) => {
    if (!eventId) return;

    const nextRole = member.role === "organizer" ? "member" : "organizer";

    setUpdatingMemberRoleId(member.id);
    try {
      await eventApi.updateMemberRole(eventId, member.id, { role: nextRole });
      await fetchEvent(false);
      setToast({
        message:
          nextRole === "organizer"
            ? "Membre promu organisateur."
            : "Rôle d’organisateur retiré.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de mettre à jour le rôle pour le moment.";
      setToast({ message, variant: "error" });
    } finally {
      setUpdatingMemberRoleId(null);
    }
  };

  const handleLeaveEvent = async () => {
    if (isLeaving || !canLeaveEvent) {
      return;
    }

    setIsLeaving(true);
    try {
      await eventApi.leave(eventId);
      setToast({ message: "Tu as quitté l’évènement.", variant: "success" });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tripcrew:eventLeft"));
      }
      router.replace("/events");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de quitter l’évènement pour le moment.";
      setToast({ message, variant: "error" });
      setIsLeaving(false);
    }
  };

  const handleRemoveInvitation = async (memberId: number) => {
    try {
      await eventApi.removeInvitation(eventId, memberId);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((member) => member.id !== memberId),
            }
          : prev,
      );
      setToast({ message: "Invitation supprimée.", variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de supprimer cette invitation pour le moment.";
      setToast({ message, variant: "error" });
    }
  };

  const handleEditStep = (step: EventStep) => {
    setEditingStep(step);
    setStepForm({
      name: step.name,
      description: step.description ?? "",
      location: step.location ?? "",
      scheduledTime: toDateTimeLocalValue(step.scheduledTime),
    });
    setStepError(null);
    setIsStepModalOpen(true);
  };

  const handleDeleteStep = async (stepId: number) => {
    if (!eventId) return;
    try {
      await eventApi.deleteStep(eventId, stepId);
      await fetchEvent(false);
      setToast({ message: "Étape supprimée.", variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de supprimer cette étape pour le moment.";
      setToast({ message, variant: "error" });
    }
  };

  const handleAcceptJoinRequest = async (requestId: number) => {
    if (!event) {
      return;
    }

    setProcessingRequest({ id: requestId, action: "accept" });
    setRequestsError(null);

    try {
      const response = await eventApi.acceptJoinRequest(eventId, requestId);
      const newMember = response.member ?? null;
      setEvent((prev) => {
        if (!prev) return prev;

        const updatedRequests = prev.joinRequests.filter((request) => request.id !== requestId);

        const updatedMembers = newMember
          ? [...prev.members.filter((member) => member.id !== newMember.id), newMember].sort((a, b) =>
              `${a.firstName ?? ""} ${a.lastName ?? ""}`.localeCompare(
                `${b.firstName ?? ""} ${b.lastName ?? ""}`,
                "fr",
                { sensitivity: "base" },
              ),
            )
          : prev.members;

        return {
          ...prev,
          members: updatedMembers,
          joinRequests: updatedRequests,
          joinRequestCount: updatedRequests.length,
        };
      });
      setToast({
        message:
          response.message ??
          "Demande acceptée. Le membre est désormais ajouté à l’évènement.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible d’accepter cette demande pour le moment.";
      setRequestsError(message);
      setToast({ message, variant: "error" });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineJoinRequest = async (requestId: number) => {
    if (!event) {
      return;
    }

    setProcessingRequest({ id: requestId, action: "decline" });
    setRequestsError(null);

    try {
      const response = await eventApi.declineJoinRequest(eventId, requestId);
      setEvent((prev) => {
        if (!prev) {
          return prev;
        }
        const updatedRequests = prev.joinRequests.filter((request) => request.id !== requestId);
        return {
          ...prev,
          joinRequests: updatedRequests,
          joinRequestCount: updatedRequests.length,
        };
      });
      setToast({
        message: response.message ?? "Demande refusée.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de refuser cette demande pour le moment.";
      setRequestsError(message);
      setToast({ message, variant: "error" });
    } finally {
      setProcessingRequest(null);
    }
  };
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleStepOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      handleCancelStep();
    }
  };

  const handleMembersOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      closeMembersModal();
    }
  };

  const handleInviteOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      handleInviteCancel();
    }
  };

  const handleRequestsOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      closeRequestsModal();
    }
  };

  const handleEventOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      closeEditEventModal();
    }
  };

  const handleEventUpdateConfirmationOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      handleCancelEventUpdateConfirmation();
    }
  };

  const handleEventFieldChange = (
    evt: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = evt.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEventCheckboxChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const { checked } = evt.target;
    setEventForm((prev) => ({
      ...prev,
      isPaid: checked,
      price: checked ? prev.price : "",
    }));
  };

  const validateEventForm = () => {
    if (!eventForm.name.trim()) {
      return "Le nom de l’évènement est obligatoire.";
    }
    if (!eventForm.startDate || !eventForm.endDate) {
      return "Merci d’indiquer les dates de début et de fin.";
    }
    const start = new Date(eventForm.startDate);
    const end = new Date(eventForm.endDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
      return "Merci d’indiquer des dates valides.";
    }
    if (end < start) {
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

  const submitEventUpdate = useCallback(
    async (payload: CreateEventPayload) => {
      if (!eventId) return;

      setIsUpdatingEvent(true);
      setEventFormError(null);

      try {
        await eventApi.update(eventId, payload);
        await fetchEvent(false);
        setIsEditEventModalOpen(false);
        setToast({ message: "Évènement mis à jour.", variant: "success" });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Impossible de mettre à jour l’évènement pour le moment.";
        setEventFormError(message);
        setToast({ message, variant: "error" });
      } finally {
        setIsUpdatingEvent(false);
      }
    },
    [eventId, fetchEvent],
  );

  const handleEventSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!eventId) return;

    const validationError = validateEventForm();
    if (validationError) {
      setEventFormError(validationError);
      return;
    }

    const payload: CreateEventPayload = {
      name: eventForm.name.trim(),
      description: eventForm.description.trim(),
      location: eventForm.location.trim(),
      startDate: new Date(eventForm.startDate).toISOString(),
      endDate: new Date(eventForm.endDate).toISOString(),
      isPaid: eventForm.isPaid,
      price: eventForm.isPaid ? Number(eventForm.price) : null,
    };

    if (event) {
      const nextStartDate = new Date(payload.startDate);
      const nextEndDate = new Date(payload.endDate);
      const currentStartDate = new Date(event.startDate);
      const currentEndDate = new Date(event.endDate);

      const hasStartChanged = currentStartDate.getTime() !== nextStartDate.getTime();
      const hasEndChanged = currentEndDate.getTime() !== nextEndDate.getTime();

      let affectedBefore = 0;
      let affectedAfter = 0;

      if (hasStartChanged) {
        affectedBefore = event.steps.filter((step) => {
          const scheduled = new Date(step.scheduledTime);
          return !Number.isNaN(scheduled.valueOf()) && scheduled < nextStartDate;
        }).length;
      }

      if (hasEndChanged) {
        affectedAfter = event.steps.filter((step) => {
          const scheduled = new Date(step.scheduledTime);
          return !Number.isNaN(scheduled.valueOf()) && scheduled > nextEndDate;
        }).length;
      }

      if ((hasStartChanged || hasEndChanged) && (affectedBefore > 0 || affectedAfter > 0)) {
        setPendingEventUpdate({
          payload,
          affectedBefore,
          affectedAfter,
        });
        setIsEventUpdateConfirmationOpen(true);
        return;
      }
    }

    await submitEventUpdate(payload);
  };

  const handleCancelEventUpdateConfirmation = () => {
    setPendingEventUpdate(null);
    setIsEventUpdateConfirmationOpen(false);
  };

  const handleConfirmEventUpdate = async () => {
    if (!pendingEventUpdate) {
      setIsEventUpdateConfirmationOpen(false);
      return;
    }

    const { payload } = pendingEventUpdate;
    setPendingEventUpdate(null);
    setIsEventUpdateConfirmationOpen(false);
    await submitEventUpdate(payload);
  };

  const handleTransferAdmin = async (memberId: number) => {
    if (!eventId) return;
    try {
      await eventApi.transferAdmin(eventId, { memberId });
      await fetchEvent(false);
      setToast({ message: "Nouvel administrateur désigné.", variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible de transférer l’administration pour le moment.";
      setToast({ message, variant: "error" });
    }
  };

  const handleRequestJoin = async () => {
    if (!eventId || isRequestingJoin) {
      return;
    }

    setJoinRequestError(null);
    setJoinRequestMessage(null);
    setIsRequestingJoin(true);

    try {
      const response = await eventApi.requestJoin(eventId);
      setJoinRequestMessage(response.message);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tripcrew:joinRequestSubmitted"));
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible d’envoyer ta demande pour le moment.";
      setJoinRequestError(message);
    } finally {
      setIsRequestingJoin(false);
    }
  };

  if (!isHydrated) {
    return null;
  }

  if (!token) {
    return null;
  }

  if (accessDenied) {
    return (
      <div className={styles.container}>
        <div className={styles.layout}>
          <section className={styles.card}>
            <div className={styles.accessDeniedBlock}>
              <h1 className={styles.accessDeniedTitle}>Accès restreint</h1>
              <p className={styles.accessDeniedText}>
                Tu ne fais pas partie de cet évènement. Tu peux demander aux organisateurs de t’ajouter en
                utilisant le bouton ci-dessous.
              </p>
              {joinRequestMessage ? (
                <div className={styles.requestSuccess}>{joinRequestMessage}</div>
              ) : null}
              {joinRequestError ? <div className={styles.stepFormError}>{joinRequestError}</div> : null}
              <div className={styles.accessDeniedActions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={handleRequestJoin}
                  disabled={isRequestingJoin}
                >
                  {isRequestingJoin ? "Demande en cours…" : "Demander à rejoindre l’évènement"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.topBar}>
            <Link href="/events" className={styles.backLink}>
              ← Retour aux évènements
            </Link>
            <div className={styles.topActions}>
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => setIsMembersModalOpen(true)}
                disabled={!event}
              >
                Voir les membres
              </button>
              {isOrganizer ? (
                <button
                  type="button"
                  className={styles.ghostAction}
                  onClick={openEditEventModal}
                  disabled={!event}
                >
                  Modifier l’évènement
                </button>
              ) : null}
              <button
                type="button"
                className={styles.leaveAction}
                onClick={handleLeaveEvent}
                disabled={!canLeaveEvent || isLeaving}
              >
                {leaveButtonLabel}
              </button>
              {isOrganizer ? (
                <>
                  <button
                    type="button"
                    className={`${styles.ghostAction} ${styles.notificationAction}`}
                    onClick={openRequestsModal}
                    disabled={!event}
                  >
                    Demandes d’invitations
                    <span
                      className={`${styles.notificationBadge} ${
                        pendingJoinRequests > 0 ? styles.notificationBadgeActive : ""
                      }`}
                    >
                      {pendingJoinRequests}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.ghostAction}
                    onClick={openInviteModal}
                    disabled={!event}
                  >
                    Inviter un membre
                  </button>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={openCreateStepModal}
                  >
                    Ajouter une étape
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className={styles.error}>{error}</div>
          ) : isLoading ? (
            <div className={styles.loading}>Chargement de l’évènement…</div>
          ) : event ? (
            <>
              <div className={styles.titleBlock}>
                <h1 className={styles.title}>{event.name}</h1>
                <p className={styles.subtitle}>{event.description || "Aucune description fournie."}</p>
              </div>

              <dl className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <dt>Début</dt>
                  <dd>{formatDateTime(event.startDate)}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Fin</dt>
                  <dd>{formatDateTime(event.endDate)}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Lieu</dt>
                  <dd>{event.location || "Lieu à confirmer"}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Tarif</dt>
                  <dd>{formatPrice(event.isPaid, event.price)}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Administrateur</dt>
                  <dd>{adminName || "Inconnu"}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </section>

        {!error && !isLoading && event ? (
          <section className={`${styles.card} ${styles.section}`}>
              <header className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Programme</h2>
                <p className={styles.sectionSubtitle}>
                  Les étapes prévues pour cet évènement. Ajout et modifications à venir.
                </p>
              </header>

              {event.steps.length === 0 ? (
                <div className={styles.emptyState}>Aucune étape planifiée pour l’instant.</div>
              ) : (
                <div className={styles.stepsList}>
                  {event.steps.map((step) => (
                    <div key={step.id} className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <h3 className={styles.stepTitle}>{step.name}</h3>
                        {isOrganizer ? (
                          <div className={styles.stepActions}>
                            <button
                              type="button"
                              className={styles.stepActionButton}
                              aria-label="Modifier l’étape"
                              onClick={() => handleEditStep(step)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className={`${styles.stepActionButton} ${styles.stepActionDelete}`}
                              aria-label="Supprimer l’étape"
                              onClick={() => handleDeleteStep(step.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {step.description ? (
                        <p className={styles.stepDescription}>{step.description}</p>
                      ) : null}
                      <div className={styles.stepMeta}>
                        <span>📍 {step.location || "Lieu à définir"}</span>
                        <span>🕒 {formatDateTime(step.scheduledTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        ) : null}
      </div>

      {isOrganizer && isStepModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleStepOverlayClick}>
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingStep ? "Modifier l’étape" : "Ajouter une étape"}
              </h2>
              <button type="button" className={styles.closeButton} onClick={handleCancelStep}>
                ×
              </button>
            </header>
            <form className={styles.stepForm} onSubmit={handleStepSubmit} noValidate>
              {stepError ? <div className={styles.stepFormError}>{stepError}</div> : null}
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="step-name" className={styles.label}>
                    Nom de l’étape
                  </label>
                  <input
                    id="step-name"
                    name="name"
                    type="text"
                    className={styles.input}
                    placeholder="Arrivée à Reykjavik"
                    value={stepForm.name}
                    onChange={handleStepFieldChange}
                    required
                  />
                </div>
              </div>
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="step-description" className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id="step-description"
                    name="description"
                    className={styles.textarea}
                    placeholder="Ce que vous prévoyez de faire"
                    value={stepForm.description}
                    onChange={handleStepFieldChange}
                  />
                </div>
              </div>
              <div className={`${styles.stepFormRow} ${styles.stepFormRowTwoCols}`}>
                <div className={styles.field}>
                  <label htmlFor="step-scheduledTime" className={styles.label}>
                    Date et heure
                  </label>
                  <input
                    id="step-scheduledTime"
                    name="scheduledTime"
                    type="datetime-local"
                    className={styles.input}
                    value={stepForm.scheduledTime}
                    onChange={handleStepFieldChange}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="step-location" className={styles.label}>
                    Lieu
                  </label>
                  <input
                    id="step-location"
                    name="location"
                    type="text"
                    className={styles.input}
                    placeholder="Adresse ou point de rendez-vous"
                    value={stepForm.location}
                    onChange={handleStepFieldChange}
                  />
                </div>
              </div>
              <div className={styles.stepFormActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={handleCancelStep}
                  disabled={isSubmittingStep}
                >
                  Annuler
                </button>
                <button type="submit" className={styles.primaryAction} disabled={isSubmittingStep}>
                  {isSubmittingStep
                    ? editingStep
                      ? "Modification…"
                      : "Ajout en cours…"
                    : editingStep
                      ? "Mettre à jour l’étape"
                      : "Ajouter l’étape"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isOrganizer && isEditEventModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleEventOverlayClick}>
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Modifier l’évènement</h2>
              <button type="button" className={styles.closeButton} onClick={closeEditEventModal}>
                ×
              </button>
            </header>
            <form className={styles.stepForm} onSubmit={handleEventSubmit} noValidate>
              {eventFormError ? <div className={styles.stepFormError}>{eventFormError}</div> : null}
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="event-name" className={styles.label}>
                    Nom
                  </label>
                  <input
                    id="event-name"
                    name="name"
                    type="text"
                    className={styles.input}
                    value={eventForm.name}
                    onChange={handleEventFieldChange}
                    required
                  />
                </div>
              </div>
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="event-description" className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id="event-description"
                    name="description"
                    className={styles.textarea}
                    value={eventForm.description}
                    onChange={handleEventFieldChange}
                  />
                </div>
              </div>
              <div className={`${styles.stepFormRow} ${styles.stepFormRowTwoCols}`}>
                <div className={styles.field}>
                  <label htmlFor="event-startDate" className={styles.label}>
                    Date de début
                  </label>
                  <input
                    id="event-startDate"
                    name="startDate"
                    type="datetime-local"
                    className={styles.input}
                    value={eventForm.startDate}
                    onChange={handleEventFieldChange}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="event-endDate" className={styles.label}>
                    Date de fin
                  </label>
                  <input
                    id="event-endDate"
                    name="endDate"
                    type="datetime-local"
                    className={styles.input}
                    value={eventForm.endDate}
                    onChange={handleEventFieldChange}
                    required
                  />
                </div>
              </div>
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="event-location" className={styles.label}>
                    Lieu
                  </label>
                  <input
                    id="event-location"
                    name="location"
                    type="text"
                    className={styles.input}
                    value={eventForm.location}
                    onChange={handleEventFieldChange}
                  />
                </div>
              </div>
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="event-isPaid" className={styles.label}>
                    Évènement payant ?
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      id="event-isPaid"
                      name="isPaid"
                      type="checkbox"
                      checked={eventForm.isPaid}
                      onChange={handleEventCheckboxChange}
                    />
                    <span>Paiement requis</span>
                  </label>
                </div>
              </div>
              {eventForm.isPaid ? (
                <div className={styles.stepFormRow}>
                  <div className={styles.field}>
                    <label htmlFor="event-price" className={styles.label}>
                      Prix (en €)
                    </label>
                    <input
                      id="event-price"
                      name="price"
                      type="number"
                      min="0"
                      className={styles.input}
                      value={eventForm.price}
                      onChange={handleEventFieldChange}
                    />
                  </div>
                </div>
              ) : null}
              <div className={styles.stepFormActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeEditEventModal}
                  disabled={isUpdatingEvent}
                >
                  Annuler
                </button>
                <button type="submit" className={styles.primaryAction} disabled={isUpdatingEvent}>
                  {isUpdatingEvent ? "Sauvegarde…" : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEventUpdateConfirmationOpen && pendingEventUpdate && eventUpdateConfirmationDetails ? (
        <div
          className={styles.modalOverlay}
          onClick={handleEventUpdateConfirmationOverlayClick}
        >
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Confirmer la modification</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleCancelEventUpdateConfirmation}
                disabled={isUpdatingEvent}
              >
                ×
              </button>
            </header>
            <div className={styles.stepForm}>
              <p>
                Le nouveau créneau ({eventUpdateConfirmationDetails.startLabel} →{" "}
                {eventUpdateConfirmationDetails.endLabel}) entraînera l’ajustement automatique de
                certaines étapes.
              </p>
              {eventUpdateConfirmationDetails.items.length > 0 ? (
                <ul>
                  {eventUpdateConfirmationDetails.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <p>Confirmer la mise à jour de l’évènement&nbsp;?</p>
              <div className={styles.stepFormActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={handleCancelEventUpdateConfirmation}
                  disabled={isUpdatingEvent}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={handleConfirmEventUpdate}
                  disabled={isUpdatingEvent}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {event && isMembersModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleMembersOverlayClick}>
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Membres de l’évènement</h2>
              <button type="button" className={styles.closeButton} onClick={closeMembersModal}>
                ×
              </button>
            </header>
            {event.members.length === 0 ? (
              <div className={styles.emptyState}>Aucun membre pour le moment.</div>
            ) : (
              <div className={styles.membersGrid}>
                {event.members.map((member) => (
                  <div
                    key={member.id}
                    className={`${styles.memberCard} ${
                      member.status === "pending" ? styles.memberCardPending : ""
                    }`}
                  >
                    <div className={styles.memberHeader}>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberNameRow}>
                          <h3 className={styles.memberName}>
                            {member.firstName} {member.lastName}
                          </h3>
                          <span className={styles.memberRoleText}>
                            {member.role === "admin"
                              ? "Administrateur"
                              : member.role === "organizer"
                                ? "Organisateur"
                                : "Membre"}
                          </span>
                          {member.status === "pending" ? (
                            <span className={styles.memberStatusBadge}>En attente</span>
                          ) : null}
                        </div>
                        <p className={styles.memberContact}>
                          Contact :{" "}
                          {(() => {
                            const parts = [member.phone, member.email].filter(
                              (value): value is string => Boolean(value),
                            );
                            return parts.length > 0 ? parts.join(" • ") : "Non renseigné";
                          })()}
                        </p>
                      </div>
                      <div className={styles.memberHeaderActions}>
                        {isAdmin &&
                        member.status === "active" &&
                        member.role !== "admin" &&
                        member.userId !== user?.id ? (
                          <button
                            type="button"
                            className={styles.memberTransferButton}
                            onClick={() => handleTransferAdmin(member.id)}
                          >
                            Nommer admin
                          </button>
                        ) : null}
                        {(() => {
                          const canToggleOrganizer =
                            member.status === "active" &&
                            member.role !== "admin" &&
                            member.userId !== user?.id &&
                            ((member.role === "member" && isOrganizer) ||
                              (member.role === "organizer" && isAdmin));

                          if (!canToggleOrganizer) {
                            return null;
                          }

                          const isLoading = updatingMemberRoleId === member.id;
                          const label = isLoading
                            ? "Mise à jour…"
                            : member.role === "organizer"
                              ? "Retirer rôle organisateur"
                              : "Nommer organisateur";

                          return (
                            <button
                              type="button"
                              className={styles.memberTransferButton}
                              onClick={() => handleToggleOrganizerRole(member)}
                              disabled={isLoading}
                            >
                              {label}
                            </button>
                          );
                        })()}
                        {isOrganizer && member.status === "pending" ? (
                          <button
                            type="button"
                            className={styles.memberRemoveButton}
                            onClick={() => handleRemoveInvitation(member.id)}
                          >
                            Retirer l’invitation
                          </button>
                        ) : null}
                        {member.status === "active" && member.userId !== user?.id
                          ? (() => {
                              if (member.role === "admin") {
                                return null;
                              }

                              if (member.role === "organizer") {
                                if (!isAdmin) {
                                  return null;
                                }
                              } else if (!isOrganizer && !isAdmin) {
                                return null;
                              }

                              return (
                                <button
                                  type="button"
                                  className={styles.memberRemoveButton}
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  Retirer du groupe
                                </button>
                              );
                            })()
                          : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isOrganizer && isRequestsModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleRequestsOverlayClick}>
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Demandes d’invitations</h2>
              <button type="button" className={styles.closeButton} onClick={closeRequestsModal}>
                ×
              </button>
            </header>
            {requestsError ? <div className={styles.stepFormError}>{requestsError}</div> : null}
            {isLoadingRequests ? (
              <div className={styles.loading}>Chargement des demandes…</div>
            ) : event?.joinRequests.length ? (
              <div className={styles.requestList}>
                {event.joinRequests.map((request) => {
                  const isProcessing = processingRequest?.id === request.id;
                  const isAccepting = isProcessing && processingRequest?.action === "accept";
                  const isDeclining = isProcessing && processingRequest?.action === "decline";
                  return (
                    <div key={request.id} className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <h3 className={styles.requestName}>
                          {request.firstName} {request.lastName}
                        </h3>
                        <p className={styles.requestContact}>
                          Contact :{" "}
                          {(() => {
                            const details = [request.phone, request.email].filter(
                              (value): value is string => Boolean(value),
                            );
                            return details.length > 0 ? details.join(" • ") : "Non renseigné";
                          })()}
                        </p>
                        <p className={styles.requestDate}>
                          Demande envoyée le {formatDateTime(request.requestedAt)}
                        </p>
                      </div>
                      <div className={styles.requestActions}>
                        <button
                          type="button"
                          className={styles.requestDecline}
                          onClick={() => handleDeclineJoinRequest(request.id)}
                          disabled={isProcessing}
                        >
                          {isDeclining ? "Refus…" : "Refuser"}
                        </button>
                        <button
                          type="button"
                          className={styles.requestAccept}
                          onClick={() => handleAcceptJoinRequest(request.id)}
                          disabled={isProcessing}
                        >
                          {isAccepting ? "Validation…" : "Accepter"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>Aucune demande en attente pour le moment.</div>
            )}
          </div>
        </div>
      ) : null}

      {isOrganizer && isInviteModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleInviteOverlayClick}>
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Inviter un membre</h2>
              <button type="button" className={styles.closeButton} onClick={handleInviteCancel}>
                ×
              </button>
            </header>
            <form className={styles.stepForm} onSubmit={handleInviteSubmit} noValidate>
              {inviteError ? <div className={styles.stepFormError}>{inviteError}</div> : null}
              <div className={styles.stepFormRow}>
                <div className={styles.field}>
                  <label htmlFor="invite-phone" className={styles.label}>
                    Numéro de téléphone
                  </label>
                  <input
                    id="invite-phone"
                    name="invite-phone"
                    type="tel"
                    className={styles.input}
                    placeholder="+33600000000"
                    value={invitePhone}
                    onChange={handleInviteInputChange}
                    required
                  />
                  <span className={styles.helper}>
                    Le contact doit déjà disposer d’un compte Trip Crew pour recevoir l’invitation.
                  </span>
                </div>
              </div>
              <div className={styles.stepFormActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={handleInviteCancel}
                  disabled={isSendingInvitation}
                >
                  Annuler
                </button>
                <button type="submit" className={styles.primaryAction} disabled={isSendingInvitation}>
                  {isSendingInvitation ? "Envoi..." : "Envoyer l’invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.variant === "success" ? styles.toastSuccess : styles.toastError
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

