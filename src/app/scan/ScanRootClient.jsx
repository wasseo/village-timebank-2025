// app/scan/ScanRootClient.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ScanRootClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const codeFromQS = sp.get("code");

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  // ✅ code 쿼리 자동 처리
  useEffect(() => {
    if (codeFromQS) {
      router.replace(`/scan/${encodeURIComponent(codeFromQS)}`);
    }
  }, [codeFromQS, router]);

  // ✅ 수동 입력 → 동일한 라우팅
  const handleSubmit = (e) => {
    e.preventDefault();
    const c = (code || "").trim();
    if (!c) return setMsg("코드를 입력하세요.");
    setMsg("처리 중…");
    router.replace(`/scan/${encodeURIComponent(c)}`);
  };

  // ✅ 클립보드 붙여넣기
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCode(text.trim());
    } catch {
      setMsg("클립보드 접근이 차단되었어요. 직접 입력해 주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-[#FFF7E3] flex flex-col items-center justify-center text-[#1F2C5D] px-6">
      {/* 헤더 */}
      <h1 className="text-2xl font-extrabold mb-3">QR 스캔</h1>
      <p className="text-center text-[#223D8F] leading-relaxed max-w-md mb-8">
        <span className="font-semibold text-[#27A36D]">휴대폰 카메라</span> 앱으로 부스 QR을 스캔하면 자동으로 처리됩니다.
        문제가 있으면 아래에 <span className="font-semibold text-[#27A36D]">코드를 직접 입력</span>해 주세요.
      </p>

      {/* 코드 입력 */}
      {!codeFromQS && (
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="예: ABC123"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full p-3 rounded-xl border border-[#A1E1A4] text-center
                       focus:outline-none focus:ring-2 focus:ring-[#2843D1] placeholder-[#7FB68A]"
          />

          {/* 버튼 그룹 */}
          <div className="flex gap-2 justify-center">
            <button
              type="submit"
              disabled={!code}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-[#2843D1] shadow-sm transition 
                          ${!code ? "opacity-60" : "hover:scale-[1.02]"}`}
            >
              코드로 처리
            </button>

            <button
              type="button"
              onClick={pasteFromClipboard}
              className="flex-1 px-4 py-3 rounded-xl font-semibold bg-white text-[#2843D1]
                         ring-1 ring-[#2843D1]/40 hover:bg-[#2843D1]/10 transition"
            >
              붙여넣기
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push("/me")}
            className="w-full mt-2 py-3 rounded-xl bg-[#27A36D] text-white font-semibold shadow-sm hover:scale-[1.02] transition"
          >
            내 활동으로
          </button>

          {/* 메시지 */}
          {msg && (
            <p
              className={`text-sm text-center mt-2 ${
                msg.includes("처리") ? "text-[#2843D1]" : "text-[#27A36D]"
              }`}
            >
              {msg}
            </p>
          )}
        </form>
      )}

      {/* QR 자동 처리 안내 */}
      {codeFromQS && (
        <p className="mt-8 text-[#2843D1] font-medium text-center">
          QR 코드를 처리 중입니다...
        </p>
      )}

      {/* 푸터 로고 */}
      <footer className="mt-16 text-sm text-[#1F2C5D] flex flex-col items-center opacity-80">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-[6px] rounded-sm bg-[#27A36D]" />
          <span className="inline-block w-6 h-[6px] rounded-sm bg-[#27A36D]" />
        </div>
        <span className="mt-2">경기도마을공동체지원센터</span>
      </footer>
    </main>
  );
}