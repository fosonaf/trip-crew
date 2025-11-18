"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { ApiError, eventApi } from "@/lib/api";
import type { EventSummary } from "@/types/event";
import styles from "./page.module.css";

const formatName = (firstName?: string | null) => {
  if (!firstName) return "Trip Crew";
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
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

export default function EventsPage() {
  const { user, token, isHydrated } = useAuthContext();
  const router = useRouter();

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinEventId, setJoinEventId] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);

  const fetchEvents = useCallback(
    async (withSpinner = true) => {
      if (!token) {
        return;
      }

      if (withSpinner) {
        setIsLoading(true);
        setFeedback(null);
      }
      setError(null);

      try {
        const data = await eventApi.list();
        setEvents(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de récupérer tes évènements pour le moment.",
        );
      } finally {
        if (withSpinner) {
          setIsLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [token, isHydrated, router]);

  useEffect(() => {
    if (!isHydrated || !token) {
      return;
    }

    fetchEvents(true);
  }, [isHydrated, token, fetchEvents]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handler = () => {
      fetchEvents(false);
    };

    window.addEventListener("tripcrew:invitationAccepted", handler);
    window.addEventListener("tripcrew:eventLeft", handler);
    return () => {
      window.removeEventListener("tripcrew:invitationAccepted", handler);
      window.removeEventListener("tripcrew:eventLeft", handler);
    };
  }, [fetchEvents]);

  const handleLeaveEvent = async (event: EventSummary) => {
    try {
      await eventApi.leave(String(event.id));
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      setFeedback("Tu as quitté l’évènement.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tripcrew:eventLeft"));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de quitter l’évènement pour le moment.",
      );
    }
  };

  const displayName = useMemo(() => formatName(user?.firstName), [user?.firstName]);

  const openJoinModal = () => {
    setJoinError(null);
    setJoinMessage(null);
    setJoinEventId("");
    setIsJoinModalOpen(true);
  };

  const closeJoinModal = () => {
    if (isRequestingJoin) return;
    setIsJoinModalOpen(false);
    setJoinError(null);
    setJoinMessage(null);
    setJoinEventId("");
  };

  const handleJoinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!joinEventId.trim()) {
      setJoinError("Merci d’indiquer l’identifiant de l’évènement.");
      setJoinMessage(null);
      return;
    }

    setIsRequestingJoin(true);
    setJoinError(null);
    setJoinMessage(null);

    try {
      const response = await eventApi.requestJoin(joinEventId.trim());
      setJoinMessage(response.message);
      setJoinEventId("");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impossible d’envoyer la demande pour le moment.";
      setJoinError(message);
    } finally {
      setIsRequestingJoin(false);
    }
  };

  const handleJoinOverlayClick = (evt: MouseEvent<HTMLDivElement>) => {
    if (evt.target === evt.currentTarget) {
      closeJoinModal();
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
      <section className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Bienvenue <span className={styles.accent}>{displayName}</span> !
          </h1>
        </div>
        {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
        <p className={styles.subtitle}>
          Prépare ton prochain voyage en invitant ton équipe, planifie chaque étape et reste synchronisé
          avec le chat temps réel. Commence dès maintenant en créant ton premier événement.
        </p>

        <div className={styles.actions}>
          <Link className={styles.button} href="/events/new">
            Créer un événement
          </Link>
          <Link className={styles.buttonSecondary} href="#">
            Voir les notifications (bientôt)
          </Link>
          <button type="button" className={styles.buttonTertiary} onClick={openJoinModal}>
            Rejoindre un événement
          </button>
        </div>
      </section>

      <section className={`${styles.card} ${styles.eventsCard}`}>
        <header className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Tes évènements</h2>
            <p className={styles.sectionSubtitle}>
              Tu trouveras ici tous les évènements auxquels tu participes, en tant qu&apos;organisateur ou
              participant.
            </p>
          </div>
          <span className={styles.counter}>{events.length}</span>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        {isLoading ? (
          <p className={styles.placeholder}>Chargement en cours…</p>
        ) : events.length === 0 ? (
          <div className={styles.empty}>
            <p>Tu n’as encore rejoint aucun évènement. Lance-toi en créant le premier&nbsp;!</p>
            <Link className={styles.button} href="/events/new">
              Nouveau évènement
            </Link>
          </div>
        ) : (
          <div className={styles.eventList}>
            {events.map((event) => (
              <div key={event.id} className={styles.eventCard}>
                <Link href={`/events/${event.id}`} className={styles.eventCardLink}>
                  <header className={styles.eventHeader}>
                    <h3 className={styles.eventTitle}>{event.name}</h3>
                    <div className={styles.eventHeaderBadges}>
                      {event.role === "admin" ? (
                        <span className={styles.roleBadge} title="Tu es administrateur">
                          <span className={styles.roleDot} aria-hidden="true" />
                          Administrateur
                        </span>
                      ) : event.role === "organizer" ? (
                        <span className={styles.roleBadge} title="Tu es organisateur">
                          <span className={styles.roleDot} aria-hidden="true" />
                          Organisateur
                        </span>
                      ) : null}
                    </div>
                  </header>
                  {event.description ? (
                    <p className={styles.eventDescription}>{event.description}</p>
                  ) : null}
                  <dl className={styles.meta}>
                    <div>
                      <dt>Date de début</dt>
                      <dd>{formatDateTime(event.startDate)}</dd>
                    </div>
                    <div>
                      <dt>Date de fin</dt>
                      <dd>{formatDateTime(event.endDate)}</dd>
                    </div>
                    <div>
                      <dt>Lieu</dt>
                      <dd>{event.location || "Non précisé"}</dd>
                    </div>
                    <div>
                      <dt>Tarif</dt>
                      <dd>
                        {event.isPaid
                          ? `${event.price?.toLocaleString("fr-FR", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })} €`
                          : "Gratuit"}
                      </dd>
                    </div>
                    <div>
                      <dt>Statut paiement</dt>
                      <dd>{event.paymentStatus ? event.paymentStatus : "—"}</dd>
                    </div>
                  </dl>
                </Link>
                <div className={styles.eventCardFooter}>
                  <button
                    type="button"
                    className={styles.leaveButton}
                    onClick={() => handleLeaveEvent(event)}
                    disabled={
                      event.role === "admin" ||
                      (event.role === "organizer" && event.organizerCount <= 1)
                    }
                  >
                    {event.role === "admin"
                      ? "Administrateur"
                      : event.role === "organizer" && event.organizerCount <= 1
                        ? "Dernier organisateur"
                        : "Quitter l’évènement"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {isJoinModalOpen ? (
        <div className={styles.joinModalOverlay} onClick={handleJoinOverlayClick}>
          <div className={styles.joinModal} role="dialog" aria-modal="true">
            <header className={styles.joinModalHeader}>
              <h2 className={styles.joinModalTitle}>Rejoindre un évènement</h2>
              <button
                type="button"
                className={styles.joinModalClose}
                onClick={closeJoinModal}
                aria-label="Fermer la fenêtre"
                disabled={isRequestingJoin}
              >
                ×
              </button>
            </header>
            <form className={styles.joinForm} onSubmit={handleJoinSubmit} noValidate>
              <label htmlFor="join-event-id" className={styles.joinLabel}>
                Identifiant de l’évènement
              </label>
              <input
                id="join-event-id"
                name="join-event-id"
                type="text"
                className={styles.joinInput}
                placeholder="Ex. 123"
                value={joinEventId}
                onChange={(evt) => setJoinEventId(evt.target.value)}
                disabled={isRequestingJoin}
                autoFocus
              />
              <p className={styles.joinHelper}>
                Demande envoyée uniquement si l’évènement existe et que tu n’en fais pas encore partie.
              </p>
              {joinError ? <div className={styles.joinError}>{joinError}</div> : null}
              {joinMessage ? <div className={styles.joinSuccess}>{joinMessage}</div> : null}
              <div className={styles.joinActions}>
                <button
                  type="button"
                  className={styles.joinSecondary}
                  onClick={closeJoinModal}
                  disabled={isRequestingJoin}
                >
                  Annuler
                </button>
                <button type="submit" className={styles.joinPrimary} disabled={isRequestingJoin}>
                  {isRequestingJoin ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}