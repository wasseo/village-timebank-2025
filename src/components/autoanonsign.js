//src/components/autoanonsign.js
"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AutoAnonSignIn() {
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();
    })();
  }, []);
  return null;
}
