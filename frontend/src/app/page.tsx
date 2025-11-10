"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/providers/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { token, isHydrated } = useAuthContext();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (token) {
      router.replace("/events");
    } else {
      router.replace("/login");
    }
  }, [token, isHydrated, router]);

  return null;
}
