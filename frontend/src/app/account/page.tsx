"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { useAuthContext } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

type FormState = {
  email: string;
  phone: string;
  avatarPreview: string | null;
};

export default function AccountPage() {
  const { user, token, isHydrated, updateUser } = useAuthContext();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    avatarPreview: user?.avatarUrl ?? null,
  });
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email,
        phone: user.phone ?? "",
        avatarPreview: user.avatarUrl ?? null,
      });
      setAvatarChanged(false);
    }
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return "TC";
    const first = user.firstName?.charAt(0) ?? "";
    const last = user.lastName?.charAt(0) ?? "";
    const label = `${first}${last}`.trim();
    return label ? label.toUpperCase() : "TC";
  }, [user]);

  if (!isHydrated) {
    return null;
  }

  if (!token) {
    return null;
  }

  const handleInputChange =
    (field: "email" | "phone") => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Merci de sélectionner un fichier image valide.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("L’image est trop volumineuse (4 Mo maximum).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatarPreview: reader.result as string }));
      setAvatarChanged(true);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarPreview: null }));
    setAvatarChanged(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.phone.trim()) {
      setError("Le numéro de téléphone est obligatoire.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        avatarUrl: avatarChanged ? form.avatarPreview : undefined,
      };

      const response = await authApi.updateProfile(payload);
      updateUser(response.user);
      setSuccess("Profil mis à jour avec succès.");
      setAvatarChanged(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Une erreur inattendue est survenue. Merci de réessayer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Gestion du compte</h1>
          <p className={styles.subtitle}>
            Mets à jour tes informations de contact et personnalise ton avatar.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {success ? (
            <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{success}</div>
          ) : null}
          {error ? <div className={`${styles.feedback} ${styles.feedbackError}`}>{error}</div> : null}

          <div className={styles.fieldset}>
            <span className={styles.label}>Avatar</span>
            <div className={styles.avatarBlock}>
              <div className={styles.avatarPreview}>
                {form.avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatarPreview} alt="Prévisualisation avatar" className={styles.avatarImage} />
                ) : (
                  initials
                )}
              </div>
              <div className={styles.avatarActions}>
                <label className={styles.fileInput}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: "none" }}
                  />
                  Choisir une image
                </label>
                <button type="button" className={styles.removeButton} onClick={handleRemoveAvatar}>
                  Supprimer l’avatar
                </button>
                <span className={styles.helper}>Formats PNG, JPG, WEBP — 4 Mo max.</span>
              </div>
            </div>
          </div>

          <div className={styles.fieldset}>
            <label className={styles.label} htmlFor="email">
              Email (optionnel)
              <input
                id="email"
                type="email"
                className={styles.input}
                value={form.email}
                onChange={handleInputChange("email")}
                autoComplete="email"
              />
            </label>

            <label className={styles.label} htmlFor="phone">
              Téléphone
              <input
                id="phone"
                type="tel"
                className={styles.input}
                value={form.phone}
                onChange={handleInputChange("phone")}
                autoComplete="tel"
                required
              />
            </label>
            <span className={styles.helper}>
              Ton numéro est partagé avec les membres de tes évènements pour coordonner le voyage.
            </span>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

