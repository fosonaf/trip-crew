"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, eventApi } from "@/lib/api";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

type FormState = {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isPaid: boolean;
  price: string;
};

const initialState: FormState = {
  name: "",
  description: "",
  location: "",
  startDate: "",
  endDate: "",
  isPaid: false,
  price: "",
};

const formatName = (firstName?: string | null) => {
  if (!firstName) return "Trip Crew";
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

export default function NewEventPage() {
  const { user, token, isHydrated } = useAuthContext();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayName = useMemo(() => formatName(user?.firstName), [user?.firstName]);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [isHydrated, token, router]);

  if (!isHydrated) {
    return null;
  }

  if (!token) {
    return null;
  }

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setForm((prev) => ({
      ...prev,
      isPaid: checked,
      price: checked ? prev.price : "",
    }));
  };

  const validate = () => {
    if (!form.name.trim()) {
      return "Le nom de l’évènement est obligatoire.";
    }
    if (!form.startDate || !form.endDate) {
      return "Merci de renseigner les dates de début et de fin.";
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
      return "Merci de saisir des dates valides.";
    }
    if (end < start) {
      return "La date de fin doit être postérieure à la date de début.";
    }
    if (form.isPaid) {
      const priceNumber = Number(form.price);
      if (!form.price || Number.isNaN(priceNumber) || priceNumber < 0) {
        return "Merci d’indiquer un prix valide (valeur positive).";
      }
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      isPaid: form.isPaid,
      price: form.isPaid ? Number(form.price) : null,
    };

    try {
      await eventApi.create(payload);
      router.replace("/events");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible de créer l’évènement pour le moment. Merci de réessayer.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Nouvel évènement</h1>
          <p className={styles.subtitle}>
            Donne un nom, des dates et un lieu à ton aventure. Nous inviterons ton équipe ensuite&nbsp;!
            Tu es connecté en tant que <strong>{displayName}</strong>.
          </p>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">
                Nom de l’évènement
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className={styles.input}
                placeholder="Road trip en Islande"
                value={form.name}
                onChange={handleFieldChange}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className={styles.textarea}
                placeholder="Objectifs, ambiance, étapes clés..."
                value={form.description}
                onChange={handleFieldChange}
              />
              <p className={styles.hint}>Quelques lignes pour partager le contexte avec ton équipe.</p>
            </div>
          </div>

          <div className={`${styles.row} ${styles.twoCols}`}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="startDate">
                Début
              </label>
              <input
                id="startDate"
                name="startDate"
                type="datetime-local"
                className={styles.input}
                value={form.startDate}
                onChange={handleFieldChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="endDate">
                Fin
              </label>
              <input
                id="endDate"
                name="endDate"
                type="datetime-local"
                className={styles.input}
                value={form.endDate}
                onChange={handleFieldChange}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location">
                Lieu principal
              </label>
              <input
                id="location"
                name="location"
                type="text"
                className={styles.input}
                placeholder="Reykjavík, Islande"
                value={form.location}
                onChange={handleFieldChange}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.checkboxField}>
              <input
                id="isPaid"
                name="isPaid"
                type="checkbox"
                className={styles.checkbox}
                checked={form.isPaid}
                onChange={handleCheckboxChange}
              />
              <label className={styles.label} htmlFor="isPaid">
                Evènement payant
              </label>
            </div>
            {form.isPaid ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="price">
                  Prix par personne (€)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.5"
                  className={styles.input}
                  placeholder="250"
                  value={form.price}
                  onChange={handleFieldChange}
                  required
                />
              </div>
            ) : (
              <p className={styles.hint}>Laisse décoché si la participation est gratuite.</p>
            )}
          </div>

          <div className={styles.actions}>
            <Link href="/events" className={styles.link}>
              Annuler et revenir
            </Link>
            <button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? "Création en cours..." : "Créer l’évènement"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

