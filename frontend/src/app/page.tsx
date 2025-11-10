import Image from "next/image";
import styles from "./page.module.css";

const LINKS = {
  templates:
    "https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app",
  docs: "https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app",
  deploy:
    "https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app",
};

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Logo Next.js"
          width={112}
          height={28}
          priority
        />

        <header>
          <h1 className={styles.title}>Bienvenue sur Trip Crew Web</h1>
          <p className={styles.intro}>
            Cette interface Next.js consommera l’API Express pour proposer une
            expérience fluide : authentification, suivi des événements, check-in
            et chat temps réel.
          </p>
        </header>

        <nav className={styles.links} aria-label="Ressources Next.js">
          <a className={styles.buttonPrimary} href={LINKS.deploy} target="_blank" rel="noreferrer">
            Déployer sur Vercel
          </a>
          <a className={styles.buttonSecondary} href={LINKS.docs} target="_blank" rel="noreferrer">
            Documentation Next.js
          </a>
          <a className={styles.buttonSecondary} href={LINKS.templates} target="_blank" rel="noreferrer">
            Templates officiels
          </a>
        </nav>

        <p className={styles.muted}>
          Modifiez <code>src/app/page.tsx</code> et <code>src/app/page.module.css</code> pour continuer.
        </p>
      </section>
    </main>
  );
}
