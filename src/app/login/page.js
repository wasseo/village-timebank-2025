// src/app/login/page.js
"use client";
import { useEffect, useState } from "react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // ✅ 이미 로그인된 상태면 /me로 보내기
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) location.href = "/me";
      })
      .catch(() => {});
  }, []);

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
      setCooldown(60); // 필요 시 15로 줄이기 가능
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
    if (j.ok) {
      setMsg("로그인 성공!");
      location.href = "/me";     // ✅ 성공 시 /me로 이동
    } else {
      setMsg(j.error || "인증 실패");
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
