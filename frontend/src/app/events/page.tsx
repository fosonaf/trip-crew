"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const formatName = (firstName?: string | null) => {
  if (!firstName) return "Trip Crew";
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

export default function EventsPage() {
  const { user, token, isHydrated, logout } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [token, isHydrated, router]);

  const displayName = useMemo(() => formatName(user?.firstName), [user?.firstName]);

  if (!isHydrated) {
    return null;
  }

  if (!token) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Bienvenue <span className={styles.accent}>{displayName}</span> !
          </h1>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
        <p className={styles.subtitle}>
          Prépare ton prochain voyage en invitant ton équipe, planifie chaque étape et reste synchronisé
          avec le chat temps réel. Cette page affichera bientôt ton tableau de bord d’événements.
        </p>

        <div className={styles.actions}>
          <Link className={styles.button} href="#">
            Créer un événement (bientôt)
          </Link>
          <Link className={styles.buttonSecondary} href="#">
            Voir les notifications (bientôt)
          </Link>
        </div>
      </section>
    </div>
  );
}

