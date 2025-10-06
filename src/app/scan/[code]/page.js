// app/scan/[code]/page.js
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ScanByPathPage({ params }) {
  const [msg, setMsg] = useState("처리 중…");
  const code = (params?.code || "").trim();

  useEffect(() => {
    (async () => {
      try {
        // 1) 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        const userId = me?.user?.id;
        if (!userId) {
          const next = encodeURIComponent(window.location.pathname);
          location.href = `/login?next=${next}`;
          return;
        }

        // 2) 부스 조회 (category/points 대신 kind/amount 사용)
        const { data: booth, error: bErr } = await supabase
          .from("booths")
          .select("id,name,kind,amount,code,is_active")
          .eq("code", code)
          .eq("is_active", true)
          .single();

        if (bErr || !booth) {
          setMsg("등록되지 않은 부스 코드입니다.");
          return;
        }

        // 3) 같은 부스 최근 3분 중복 방지
        const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("activities")
          .select("id")
          .eq("user_id", userId)
          .eq("booth_id", booth.id)
          .gte("created_at", since)
          .limit(1);
        if (recent?.length) {
          setMsg(`최근에 이미 처리된 부스입니다: ${booth.name}`);
          return;
        }

        // 4) 부스 타깃(도메인) 조회
        const { data: targets, error: tErr } = await supabase
          .from("booth_targets")
          .select("domain_code,factor")
          .eq("booth_id", booth.id);

        if (tErr) {
          console.error(tErr);
          setMsg("부스 설정을 불러오지 못했어요.");
          return;
        }

        // 타깃이 없으면 안전하게 social 1건으로 처리
        const list = (targets?.length ? targets : [{ domain_code: "social", factor: 1 }]);

        const base = Number(booth.amount || 0);
        // 5) 도메인별 활동 행 생성 (redeem도 양수, kind로만 구분)
        const rows = list.map(t => ({
          user_id: userId,
          booth_id: booth.id,
          category: t.domain_code,                 // social | environment | economic | mental
          points: base * Number(t.factor || 1),    // 항상 양수
          kind: booth.kind || "earn",              // earn | redeem
        }));

        // 6) 일괄 INSERT
        const { error: aErr } = await supabase.from("activities").insert(rows);
        if (aErr) {
          console.error(aErr);
          setMsg("활동 기록 중 오류가 발생했어요.");
          return;
        }

        // 7) 완료 메시지
        const summary = rows.map(r => `${r.category}+${r.points}`).join(", ");
        setMsg(`처리 완료! ${booth.name} · ${summary}`);
        // 필요하면 자동 이동:
        // setTimeout(() => (location.href = "/me"), 1200);
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
