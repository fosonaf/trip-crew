"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "../page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authApi.login({ email, password });
      login(result);
      router.replace("/events");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Identifiants invalides. Vérifiez l’email ou le mot de passe.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Une erreur inattendue est survenue. Veuillez réessayer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.subtitle}>
          Accédez à vos événements Trip Crew pour organiser vos voyages de groupe.
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="alice@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label className={styles.label}>
          Mot de passe
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </label>

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className={styles.switch}>
        Pas encore de compte ?{" "}
        <Link className={styles.link} href="/register">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

