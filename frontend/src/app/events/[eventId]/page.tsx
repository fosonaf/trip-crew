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
import { eventApi } from "@/lib/api";
import type { CreateStepPayload, EventDetail } from "@/types/event";
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
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({
    name: "",
    description: "",
    location: "",
    scheduledTime: "",
    alertBeforeMinutes: "30",
  });
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (!isHydrated || !token || !eventId) {
      return;
    }

    const fetchEvent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await eventApi.detail(eventId);
        setEvent(data);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de charger le détail de l’évènement.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [isHydrated, token, eventId]);

  const organizerName = useMemo(() => {
    if (!event) return "";
    return `${event.createdBy.firstName} ${event.createdBy.lastName}`.trim();
  }, [event]);

  const isOrganizer = useMemo(() => {
    if (!event || !user) return false;
    return event.members.some((member) => member.userId === user.id && member.role === "organizer");
  }, [event, user]);

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
      alertBeforeMinutes: "30",
    });
    setStepError(null);
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

    const payload: CreateStepPayload = {
      name: stepForm.name.trim(),
      description: stepForm.description.trim() || null,
      location: stepForm.location.trim() || null,
      scheduledTime: new Date(stepForm.scheduledTime).toISOString(),
      alertBeforeMinutes: stepForm.alertBeforeMinutes
        ? Number(stepForm.alertBeforeMinutes)
        : null,
    };

    setIsSubmittingStep(true);
    setStepError(null);

    try {
      const newStep = await eventApi.createStep(eventId, payload);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              steps: [...prev.steps, newStep].sort(
                (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime(),
              ),
            }
          : prev,
      );
      resetStepForm();
      closeStepModal();
      setToast({ message: "Étape ajoutée avec succès.", variant: "success" });
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

  if (!isHydrated) {
    return null;
  }

  if (!token) {
    return null;
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
                  className={styles.primaryAction}
                  onClick={() => setIsStepModalOpen(true)}
                >
                  Ajouter une étape
                </button>
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
                  <dt>Organisateur</dt>
                  <dd>{organizerName || "Inconnu"}</dd>
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
                      <h3 className={styles.stepTitle}>{step.name}</h3>
                      {step.description ? (
                        <p className={styles.stepDescription}>{step.description}</p>
                      ) : null}
                      <div className={styles.stepMeta}>
                        <span>📍 {step.location || "Lieu à définir"}</span>
                        <span>🕒 {formatDateTime(step.scheduledTime)}</span>
                        {step.alertBeforeMinutes ? (
                          <span>
                            ⏰ Rappel {step.alertBeforeMinutes} minute
                            {step.alertBeforeMinutes > 1 ? "s" : ""} avant
                          </span>
                        ) : null}
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
              <h2 className={styles.modalTitle}>Ajouter une étape</h2>
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
              <div className={`${styles.stepFormRow} ${styles.stepFormRowTwoCols}`}>
                <div className={styles.field}>
                  <label htmlFor="step-alertBeforeMinutes" className={styles.label}>
                    Rappel (minutes avant)
                  </label>
                  <input
                    id="step-alertBeforeMinutes"
                    name="alertBeforeMinutes"
                    type="number"
                    min="0"
                    className={styles.input}
                    value={stepForm.alertBeforeMinutes}
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
                  {isSubmittingStep ? "Ajout en cours…" : "Ajouter l’étape"}
                </button>
              </div>
            </form>
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
                  <div key={member.id} className={styles.memberCard}>
                    <div className={styles.memberHeader}>
                      <h3 className={styles.memberName}>
                        {member.firstName} {member.lastName}
                      </h3>
                      {member.role === "organizer" ? (
                        <span className={styles.roleTag}>Organisateur</span>
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
                ))}
              </div>
            )}
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

