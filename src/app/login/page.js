// src/app/login/page.js
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic"; // 프리렌더/CSR bail-out 관련 빌드 오류 방지

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">로딩 중…</div>}>
      <LoginBody />
    </Suspense>
  );
}

function LoginBody() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/me";

  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // 이미 로그인된 상태면 프로필 상태에 따라 분기
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
        if (me?.user) {
          const pc = await fetch("/api/profile-check").then((r) => r.json());
          location.href = pc.redirectTo === "/register" ? "/register" : next;
        }
      } catch {}
    })();
  }, [next]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const request = async () => {
    setMsg("");
    const r = await fetch("/api/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const j = await r.json();
    if (j.ok) {
      setSent(true);
      setCooldown(60);
      setMsg("문자를 보냈습니다.");
    } else {
      setMsg(j.error || "요청 실패");
    }
  };

  const verify = async () => {
    setMsg("");
    const r = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const j = await r.json();

    if (!j.ok) {
      setMsg(j.error || "인증 실패");
      return;
    }

    try {
      const pc = await fetch("/api/profile-check").then((r) => r.json());
      if (pc.redirectTo === "/register") {
        location.href = "/register";
      } else {
        location.href = next; // next가 있으면 그쪽, 없으면 /me
      }
    } catch {
      location.href = "/me";
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">휴대폰 로그인</h1>

      <input
        className="border w-full p-2 rounded"
        placeholder="전화번호 (예: 01012345678)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={sent}
      />

      {!sent ? (
        <button
          className="w-full p-2 rounded bg-black text-white disabled:opacity-50"
          onClick={request}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `${cooldown}s` : "코드 받기"}
        </button>
      ) : (
        <>
          <input
            className="border w-full p-2 rounded"
            placeholder="인증코드 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="w-full p-2 rounded bg-black text-white" onClick={verify}>
            인증하기
          </button>
        </>
      )}

      <p className="text-sm text-gray-600">{msg}</p>
    </div>
  );
}
