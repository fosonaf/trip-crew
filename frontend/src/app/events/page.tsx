"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { eventApi } from "@/lib/api";
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

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [token, isHydrated, router]);

  useEffect(() => {
    if (!isHydrated || !token) {
      return;
    }

    const fetchEvents = async () => {
      setIsLoading(true);
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
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [isHydrated, token]);

  const displayName = useMemo(() => formatName(user?.firstName), [user?.firstName]);

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
              <Link key={event.id} href={`/events/${event.id}`} className={styles.eventCard}>
                <header className={styles.eventHeader}>
                  <h3 className={styles.eventTitle}>{event.name}</h3>
                  {event.role === "organizer" ? (
                    <span className={styles.roleBadge} title="Tu es organisateur">
                      <span className={styles.roleDot} aria-hidden="true" />
                      Organisateur
                    </span>
                  ) : null}
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}