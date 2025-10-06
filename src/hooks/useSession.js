"use client";
import { useEffect, useState } from "react";

export function useSession() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);
  return user;
}
