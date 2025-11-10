"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthContext } from "@/components/providers/AuthProvider";
import { invitationApi } from "@/lib/api";
import type { PendingInvitation } from "@/types/event";
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

  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeInvitationAction, setActiveInvitationAction] = useState<{ memberId: number; type: "accept" | "decline" } | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/register");

  const shouldHide = !isHydrated || !token || !user || !pathname || isAuthRoute;

  const initials = useMemo(() => computeInitials(user?.firstName, user?.lastName), [user]);
  const pendingCount = invitations.length;

  const fetchInvitations = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoadingInvitations(true);
    setInvitationError(null);
    try {
      const data = await invitationApi.pending();
      setInvitations(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de récupérer les invitations.";
      setInvitationError(message);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [token]);

useEffect(() => {
  if (shouldHide) {
    return;
  }
  fetchInvitations();
}, [shouldHide, fetchInvitations]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
    if (!isMenuOpen) {
      setInvitationError(null);
      fetchInvitations();
    }
  };

  const handleAcceptInvitation = async (memberId: number) => {
    try {
      setActiveInvitationAction({ memberId, type: "accept" });
      await invitationApi.accept(memberId);
      setInvitations((prev) => prev.filter((invitation) => invitation.memberId !== memberId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d’accepter l’invitation pour le moment.";
      setInvitationError(message);
    } finally {
      setActiveInvitationAction(null);
    }
  };

  const handleDeclineInvitation = async (memberId: number) => {
    try {
      setActiveInvitationAction({ memberId, type: "decline" });
      await invitationApi.decline(memberId);
      setInvitations((prev) => prev.filter((invitation) => invitation.memberId !== memberId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de refuser l’invitation pour le moment.";
      setInvitationError(message);
    } finally {
      setActiveInvitationAction(null);
    }
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMenuOpen]);

if (shouldHide) {
  return null;
}

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
        <div className={styles.notifications} ref={notificationsRef}>
          <button
            type="button"
            className={styles.notificationsButton}
            onClick={handleToggleMenu}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
          >
            Invitations
            {pendingCount > 0 ? <span className={styles.badge}>{pendingCount}</span> : null}
          </button>
          {isMenuOpen ? (
            <div className={styles.dropdown} role="menu">
              <div className={styles.dropdownHeader}>
                <h3>Invitations</h3>
                <span className={styles.dropdownHint}>
                  {pendingCount > 0
                    ? `${pendingCount} invitation${pendingCount > 1 ? "s" : ""} en attente`
                    : "Aucune invitation en attente"}
                </span>
              </div>
              {invitationError ? (
                <div className={styles.dropdownError}>{invitationError}</div>
              ) : null}
              {isLoadingInvitations ? (
                <p className={styles.dropdownPlaceholder}>Chargement…</p>
              ) : invitations.length === 0 ? (
                <p className={styles.dropdownPlaceholder}>Tout est à jour.</p>
              ) : (
                <ul className={styles.invitationList}>
                  {invitations.map((invitation) => (
                    <li key={invitation.memberId} className={styles.invitationItem}>
                      <div className={styles.invitationMeta}>
                        <span className={styles.invitationEvent}>{invitation.eventName}</span>
                        <span className={styles.invitationSender}>
                          Invité par {invitation.inviter ?? "un organisateur"}
                        </span>
                      </div>
                      <div className={styles.invitationActions}>
                        <button
                          type="button"
                          className={`${styles.invitationActionButton} ${styles.invitationActionAccept}`}
                          onClick={() => handleAcceptInvitation(invitation.memberId)}
                          aria-label="Accepter l’invitation"
                          disabled={activeInvitationAction?.memberId === invitation.memberId}
                        >
                          {activeInvitationAction?.memberId === invitation.memberId &&
                          activeInvitationAction?.type === "accept"
                            ? "…"
                            : "✓"}
                        </button>
                        <button
                          type="button"
                          className={`${styles.invitationActionButton} ${styles.invitationActionDecline}`}
                          onClick={() => handleDeclineInvitation(invitation.memberId)}
                          aria-label="Refuser l’invitation"
                          disabled={activeInvitationAction?.memberId === invitation.memberId}
                        >
                          {activeInvitationAction?.memberId === invitation.memberId &&
                          activeInvitationAction?.type === "decline"
                            ? "…"
                            : "✕"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
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

