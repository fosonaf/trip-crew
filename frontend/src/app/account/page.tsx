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
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type FieldErrors = {
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function AccountPage() {
  const { user, token, isHydrated, updateUser } = useAuthContext();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    avatarPreview: user?.avatarUrl ?? null,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/login");
    }
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email ?? "",
        phone: user.phone ?? "",
        avatarPreview: user.avatarUrl ?? null,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
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
    (field: "email" | "phone" | "currentPassword" | "newPassword" | "confirmPassword") =>
    (event: ChangeEvent<HTMLInputElement>) => {
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
    setFieldErrors({});

    if (!form.phone.trim()) {
      setError("Le numéro de téléphone est obligatoire.");
      setFieldErrors({ phone: "Le numéro de téléphone est obligatoire." });
      return;
    }

    const wantsPasswordChange =
      form.currentPassword.trim().length > 0 ||
      form.newPassword.trim().length > 0 ||
      form.confirmPassword.trim().length > 0;

    if (wantsPasswordChange) {
      if (!form.currentPassword.trim() || !form.newPassword.trim() || !form.confirmPassword.trim()) {
        setError("Merci de remplir tous les champs liés au mot de passe.");
        setFieldErrors({
          currentPassword: !form.currentPassword.trim()
            ? "Le mot de passe actuel est requis."
            : undefined,
          newPassword: !form.newPassword.trim() ? "Le nouveau mot de passe est requis." : undefined,
          confirmPassword: !form.confirmPassword.trim()
            ? "La confirmation est requise."
            : undefined,
        });
        return;
      }
      if (form.newPassword.trim().length < 8) {
        setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        setFieldErrors({
          newPassword: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
        });
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError("La confirmation ne correspond pas au nouveau mot de passe.");
        setFieldErrors({
          confirmPassword: "La confirmation doit correspondre au nouveau mot de passe.",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Parameters<typeof authApi.updateProfile>[0] = {
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        avatarUrl: avatarChanged ? form.avatarPreview : undefined,
      };

      if (wantsPasswordChange) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
        payload.confirmPassword = form.confirmPassword;
      }

      const response = await authApi.updateProfile(payload);
      updateUser(response.user);
      setSuccess(
        wantsPasswordChange
          ? "Profil et mot de passe mis à jour avec succès."
          : "Profil mis à jour avec succès.",
      );
      setAvatarChanged(false);
      setForm((prev) => ({
        ...prev,
        email: response.user.email ?? "",
        phone: response.user.phone ?? "",
        avatarPreview: response.user.avatarUrl ?? null,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.message.includes("actuel")) {
          setFieldErrors({ currentPassword: err.message });
        } else if (err.message.includes("8 caractères")) {
          setFieldErrors({ newPassword: err.message });
        } else if (err.message.toLowerCase().includes("confirmation")) {
          setFieldErrors({ confirmPassword: err.message });
        } else if (err.message.toLowerCase().includes("téléphone")) {
          setFieldErrors({ phone: err.message });
        }
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
            {fieldErrors.phone ? (
              <span className={styles.fieldError}>{fieldErrors.phone}</span>
            ) : null}
            </label>
            <span className={styles.helper}>
              Ton numéro est partagé avec les membres de tes évènements pour coordonner le voyage.
            </span>
          </div>

        <div className={styles.fieldset}>
          <h2 className={styles.sectionTitle}>Mot de passe</h2>
          <p className={styles.helper}>
            Pour modifier ton mot de passe, indique l’actuel puis choisis un nouveau mot de passe
            d’au moins 8 caractères.
          </p>

          <label className={styles.label} htmlFor="current-password">
            Mot de passe actuel
            <input
              id="current-password"
              type="password"
              className={styles.input}
              value={form.currentPassword}
              onChange={handleInputChange("currentPassword")}
              autoComplete="current-password"
            />
            {fieldErrors.currentPassword ? (
              <span className={styles.fieldError}>{fieldErrors.currentPassword}</span>
            ) : null}
          </label>

          <label className={styles.label} htmlFor="new-password">
            Nouveau mot de passe
            <input
              id="new-password"
              type="password"
              className={styles.input}
              value={form.newPassword}
              onChange={handleInputChange("newPassword")}
              autoComplete="new-password"
              minLength={8}
            />
            {fieldErrors.newPassword ? (
              <span className={styles.fieldError}>{fieldErrors.newPassword}</span>
            ) : null}
          </label>

          <label className={styles.label} htmlFor="confirm-password">
            Confirmation du nouveau mot de passe
            <input
              id="confirm-password"
              type="password"
              className={styles.input}
              value={form.confirmPassword}
              onChange={handleInputChange("confirmPassword")}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword ? (
              <span className={styles.fieldError}>{fieldErrors.confirmPassword}</span>
            ) : null}
          </label>
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

