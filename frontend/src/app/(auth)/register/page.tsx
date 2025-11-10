"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "../page.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthContext();

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone.trim() || undefined,
      };

      const result = await authApi.register(payload);
      login(result);
      router.replace("/events");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError(err.message ?? "Impossible de créer le compte.");
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
        <h1 className={styles.title}>Créer un compte</h1>
        <p className={styles.subtitle}>
          Lancez votre premier voyage en équipe et invitez vos coéquipiers en quelques clics.
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.label}>
          Prénom
          <input
            className={styles.input}
            value={form.firstName}
            onChange={handleChange("firstName")}
            placeholder="Alice"
            required
            autoComplete="given-name"
          />
        </label>

        <label className={styles.label}>
          Nom
          <input
            className={styles.input}
            value={form.lastName}
            onChange={handleChange("lastName")}
            placeholder="Martin"
            required
            autoComplete="family-name"
          />
        </label>

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            placeholder="alice@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label className={styles.label}>
          Téléphone (optionnel)
          <input
            className={styles.input}
            type="tel"
            value={form.phone}
            onChange={handleChange("phone")}
            placeholder="+33600000000"
            autoComplete="tel"
          />
        </label>

        <label className={styles.label}>
          Mot de passe
          <input
            className={styles.input}
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            minLength={6}
          />
        </label>

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Création du compte..." : "S’inscrire"}
        </button>
      </form>

      <p className={styles.switch}>
        Déjà membre ?{" "}
        <Link className={styles.link} href="/login">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

