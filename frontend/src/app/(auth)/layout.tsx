import type { ReactNode } from "react";
import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>{children}</div>
    </div>
  );
}

