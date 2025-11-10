"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "./AppHeader.module.css";

const computeInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.charAt(0) ?? "";
  const last = lastName?.charAt(0) ?? "";
  const letters = `${first}${last}`.trim();
  return letters ? letters.toUpperCase() : "TC";
};

export function AppHeader() {
  const { user, token, isHydrated, logout } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/register");

  const shouldHide = !isHydrated || !token || !user || !pathname || isAuthRoute;

  const initials = useMemo(() => computeInitials(user?.firstName, user?.lastName), [user]);

  if (shouldHide) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className={styles.header}>
      <div className={styles.branding}>
        <Link href="/events" className={styles.logo}>
          Trip Crew
        </Link>
        <nav className={styles.nav}>
          <Link
            href="/events"
            className={pathname.startsWith("/events") ? styles.navLinkActive : styles.navLink}
          >
            Évènements
          </Link>
        </nav>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.logout} onClick={handleLogout}>
          Se déconnecter
        </button>
        <Link href="/account" className={styles.avatarButton} title="Gérer mon compte">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="Avatar utilisateur" className={styles.avatarImage} />
          ) : (
            <span className={styles.avatarFallback}>{initials}</span>
          )}
        </Link>
      </div>
    </header>
  );
}

