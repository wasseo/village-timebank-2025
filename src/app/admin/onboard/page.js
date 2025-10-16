// /src/app/admin/onboard/page.js

"use client";

import { useState } from "react";

export default function AdminOnboardPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [tempCode, setTempCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // 🔑 폼 바깥에서 미리 정규화
  const normalizedPhone = phone.replace(/[^0-9]/g, "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTempCode(null);
    setSuccessMessage(null);
    setLoading(true);

    if (normalizedPhone.length < 10) {
      setError("유효한 핸드폰 번호(10자리 이상)를 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, name }),
      });

      const json = await res.json();

      if (res.status === 403) {
        throw new Error("권한 없음: 이 기능을 사용할 운영진 권한이 없습니다.");
      }
      if (!json.ok) {
        throw new Error(json.error || "계정 생성 및 코드 발급에 실패했습니다.");
      }

      setTempCode(json.code);
      setSuccessMessage(
        `✅ ${name || "고객"} 계정 처리 완료. 유효기간: ${
          json.expires_at
            ? new Date(json.expires_at).toLocaleTimeString()
            : "10분 이내"
        }`
      );
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D]">
      <div className="mx-auto px-6 py-8" style={{ maxWidth: 960 }}>
        {/* 헤더 */}
        <div className="mb-6">
          <div className="rounded-2xl p-5 shadow-sm ring-1 ring-[#8F8AE6]/30 bg-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-[28px] md:text-[32px] font-extrabold tracking-tight">
                  운영진 · 고객 수동 가입
                </h1>
                <p className="text-sm md:text-base text-[#4E5A99] mt-1">
                  문자 인증이 어려운 고객의 계정을 생성하고 임시 코드를 발급합니다.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2843D1] to-[#8F8AE6] text-white font-semibold shadow">
                  Admin Onboard
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 본문 카드 */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* 입력 폼 */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-[#8F8AE6]/30 p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-semibold text-[#223D8F]"
                >
                  고객 핸드폰 번호
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  required
                  disabled={loading}
                  className="mt-1 w-full rounded-2xl border-0 ring-1 ring-inset ring-[#8F8AE6]/40 focus:ring-2 focus:ring-[#2843D1] px-4 py-3 shadow-xs bg-white"
                />
                <p className="mt-1 text-xs text-[#6B73A9]">
                  하이픈 없이 숫자만 입력 • 현재 입력:{' '}
                  <span className="font-mono">{normalizedPhone}</span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-[#223D8F]"
                >
                  고객 이름 (선택)
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  disabled={loading}
                  className="mt-1 w-full rounded-2xl border-0 ring-1 ring-inset ring-[#8F8AE6]/40 focus:ring-2 focus:ring-[#2843D1] px-4 py-3 shadow-xs bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading || normalizedPhone.length < 10}
                className="w-full rounded-2xl py-3 font-bold text-white shadow-sm
                bg-[#2843D1] hover:bg-[#223BC2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2843D1]
                disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "처리 중…" : "계정 생성 및 코드 발급"}
              </button>
            </form>

            {/* 상태 메시지 */}
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 ring-1 ring-red-300 text-red-800">
                오류: {error}
              </div>
            )}
            {successMessage && !error && (
              <div className="mt-4 p-4 rounded-xl bg-green-50 ring-1 ring-green-300 text-green-800">
                {successMessage}
              </div>
            )}
          </div>

          {/* 발급 코드 표시 패널 */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-[#8F8AE6]/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight">
                임시 로그인 코드
              </h2>
              <span className="text-xs font-semibold px-2 py-1 rounded-full ring-1 ring-[#8F8AE6]/40">
                발급 후 10분 내 사용
              </span>
            </div>

            {tempCode ? (
              <div className="space-y-4">
                <div className="relative">
                  {/* halo */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl blur-xl opacity-30 bg-gradient-to-r from-[#8F8AE6] to-[#2843D1]"
                  />
                  <div className="relative rounded-2xl bg-white p-6 ring-1 ring-dashed ring-[#2843D1]/50 text-center">
                    <div className="text-xs text-[#4E5A99] mb-1">
                      아래 코드를 고객에게 안내하세요
                    </div>
                    <div className="text-5xl font-black tracking-widest text-[#2843D1]">
                      {tempCode}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(tempCode);
                    }}
                    className="flex-1 rounded-xl py-2 font-semibold ring-1 ring-[#8F8AE6]/40 hover:bg-[#F7F4FF]"
                  >
                    코드 복사
                  </button>
                  <button
                    onClick={() => {
                      setTempCode(null);
                      setPhone("");
                      setName("");
                      setSuccessMessage(null);
                      setError(null);
                    }}
                    className="flex-1 rounded-xl py-2 font-semibold text-white bg-[#1F2C5D] hover:bg-[#18244A] shadow-sm"
                  >
                    새 고객 처리
                  </button>
                </div>

                <p className="text-xs text-[#6B73A9]">
                  * 유효시간이 지나면 새 코드를 발급해주세요.
                </p>
              </div>
            ) : (
              <div className="text-sm text-[#4E5A99]">
                아직 발급된 코드가 없습니다. 왼쪽 폼에서 고객 정보를 입력하고
                <span className="font-semibold"> “계정 생성 및 코드 발급”</span>을
                눌러주세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}