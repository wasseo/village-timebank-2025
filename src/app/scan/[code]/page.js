"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = params?.code || "";

  useEffect(() => {
    (async () => {
      try {
        // 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          const next = encodeURIComponent(window.location.pathname);
          location.href = `/login?next=${next}`;
          return;
        }

        // 부스 조회
        const { data: booth, error: bErr } = await supabase
          .from("booths")
          .select("id,name,category,points,kind")
          .eq("code", code)
          .single();

        if (bErr || !booth) {
          setMsg("등록되지 않은 부스 코드입니다.");
          return;
        }

        // 최근 중복 방지 (3분)
        const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("activities")
          .select("id")
          .eq("user_id", me.user.id)
          .eq("booth_id", booth.id)
          .gte("created_at", since)
          .limit(1);

        if (recent?.length) {
          setMsg(`최근에 이미 처리된 부스입니다: ${booth.name}`);
          return;
        }

        // 활동 기록 추가
        const { error: aErr } = await supabase.from("activities").insert({
          user_id: me.user.id,
          booth_id: booth.id,
          category: booth.category,
          points: booth.points,
          kind: booth.kind || "earn",
        });
        if (aErr) throw aErr;

        setMsg(`처리 완료! ${booth.name} · ${booth.category} · +${booth.points}pt`);
      } catch (e) {
        console.error(e);
        setMsg("오류가 발생했어요.");
      }
    })();
  }, [code]);

  return (
    <main style={{ padding: 24 }}>
      <h1>QR 처리</h1>
      <p>{msg}</p>
    </main>
  );
}
