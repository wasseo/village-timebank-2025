// src/app/login/page.js
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

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

  const [loginMode, setLoginMode] = useState("sms");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [tempCode, setTempCode] = useState("");

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

  // ---- 기존 기능 유지 ----
  const request = async () => {
    if (isSending || cooldown > 0) return;
    if (!phone) return setMsg("전화번호를 입력해주세요.");
    setMsg("");
    setIsSending(true);
    try {
      const r = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "요청 실패");
      setSent(true);
      setCooldown(Number(j.resend_after ?? 60));
      setMsg("인증번호를 보냈습니다.");
    } catch (e) {
      setMsg(e.message || "전송 실패");
    } finally {
      setIsSending(false);
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
    if (!j.ok) return setMsg(j.error || "인증 실패");
    try {
      const pc = await fetch("/api/profile-check").then((r) => r.json());
      location.href = pc.redirectTo === "/register" ? "/register" : next;
    } catch {
      location.href = "/me";
    }
  };

  const verifyTempCode = async () => {
    setMsg("");
    if (!phone || !tempCode) return setMsg("번호와 코드를 모두 입력해주세요.");
    const r = await fetch("/api/login/temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, temp_code: tempCode }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) return setMsg(j.error || "로그인 실패");
    try {
      const pc = await fetch("/api/profile-check").then((r) => r.json());
      location.href = pc.redirectTo === "/register" ? "/register" : next;
    } catch {
      location.href = "/me";
    }
  };

  const renderSmsForm = () => (
    <>
      <input
        className="w-full p-3 rounded-xl border border-[#B9E8FF] focus:outline-none focus:ring-2 focus:ring-[#1F2C5D] placeholder-[#4D7094]"
        placeholder="휴대폰 번호 (예: 01012345678)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={sent}
      />
      {!sent ? (
        <button
          onClick={request}
          disabled={isSending || cooldown > 0 || !phone}
          className={`w-full p-3 rounded-xl text-white font-semibold bg-[#1F2C5D] shadow-md transition ${
            isSending || cooldown > 0 || !phone ? "opacity-60" : "hover:scale-[1.02]"
          }`}
        >
          {isSending ? "발송 중…" : cooldown > 0 ? `${cooldown}s 후 재전송` : "인증번호 발송"}
        </button>
      ) : (
        <>
          <input
            className="w-full p-3 rounded-xl border border-[#B9E8FF] focus:outline-none focus:ring-2 focus:ring-[#1F2C5D]"
            placeholder="인증코드 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            onClick={verify}
            className="w-full p-3 rounded-xl text-white font-semibold bg-[#FF8F3C] shadow-md hover:scale-[1.02] transition"
          >
            인증하기
          </button>
        </>
      )}
    </>
  );

  const renderTempCodeForm = () => (
    <>
      <input
        className="w-full p-3 rounded-xl border border-[#B9E8FF] focus:outline-none focus:ring-2 focus:ring-[#1F2C5D]"
        placeholder="휴대폰 번호 (운영진 등록 번호)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={isSending}
      />
      <input
        className="w-full p-3 rounded-xl border border-[#B9E8FF] focus:outline-none focus:ring-2 focus:ring-[#1F2C5D]"
        placeholder="운영진이 발급한 임시 코드"
        value={tempCode}
        onChange={(e) => setTempCode(e.target.value)}
      />
      <button
        onClick={verifyTempCode}
        disabled={isSending || !phone || !tempCode}
        className={`w-full p-3 rounded-xl text-white font-semibold bg-[#1F2C5D] shadow-md transition ${
          isSending || !phone || !tempCode ? "opacity-60" : "hover:scale-[1.02]"
        }`}
      >
        {isSending ? "로그인 처리 중..." : "임시 코드로 로그인"}
      </button>
    </>
  );

  return (
    <main className="min-h-screen bg-[#7FD6FF] text-[#1F2C5D] flex flex-col justify-center items-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <Confetti />
      </div>

      <div className="text-center mb-10 z-10">
        <h1 className="text-[64px] font-extrabold text-white leading-none drop-shadow-md">
          2025
        </h1>
        <h2 className="text-[36px] font-extrabold text-[#FF8F3C] leading-none mt-1">
          마을데이터 챌린지
        </h2>
        <p className="mt-3 text-base text-[#1F2C5D] font-medium">
          참가자 인증 로그인
        </p>
      </div>

      <div className="flex w-full max-w-xs mb-4 p-1 bg-white/70 rounded-xl shadow-inner border border-[#B9E8FF]/50 z-10">
        <button
          onClick={() => setLoginMode("sms")}
          className={`flex-1 p-2 rounded-lg font-semibold text-sm transition ${
            loginMode === "sms"
              ? "bg-[#1F2C5D] text-white"
              : "text-[#1F2C5D] hover:bg-[#1F2C5D]/10"
          }`}
        >
          문자 인증 로그인
        </button>
        <button
          onClick={() => setLoginMode("temp")}
          className={`flex-1 p-2 rounded-lg font-semibold text-sm transition ${
            loginMode === "temp"
              ? "bg-[#FF8F3C] text-white"
              : "text-[#FF8F3C] hover:bg-[#FF8F3C]/10"
          }`}
        >
          운영진 코드 로그인
        </button>
      </div>

      <div className="w-full max-w-xs space-y-3 z-10">
        {loginMode === "sms" ? renderSmsForm() : renderTempCodeForm()}
        {msg && <p className="text-sm text-[#1F2C5D] mt-2 text-center">{msg}</p>}
      </div>
    </main>
  );
}

function Confetti() {
  const shapes = Array.from({ length: 15 });
  return shapes.map((_, i) => (
    <div
      key={i}
      className="absolute rounded-full"
      style={{
        backgroundColor: i % 2 ? "#FFFFFF" : "#FF8F3C",
        width: `${5 + (i % 3) * 3}px`,
        height: `${5 + (i % 3) * 3}px`,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
      }}
    />
  ));
}
