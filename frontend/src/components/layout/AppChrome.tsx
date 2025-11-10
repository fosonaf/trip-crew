"use client";

import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import styles from "./AppChrome.module.css";

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AppHeader />
      <main className={styles.main}>{children}</main>
    </div>
  );
}

