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

  // 1) 쿼리에 code가 있으면 기존 흐름 유지: /scan/{code}로 넘김
  useEffect(() => {
    if (codeFromQS) {
      router.replace(`/scan/${encodeURIComponent(codeFromQS)}`);
    }
  }, [codeFromQS, router]);

  // 2) 수동 입력 제출 → 동일한 단일 경로 처리로 통일
  const handleSubmit = async (e) => {
    e.preventDefault();
    const c = (code || "").trim();
    if (!c) return setMsg("코드를 입력하세요.");
    setMsg("처리 중…");
    // 기존 흐름을 재사용: API 직접 호출 대신 /scan/{code}로 라우팅
    router.replace(`/scan/${encodeURIComponent(c)}`);
  };

  // 3) (옵션) 클립보드 붙여넣기
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCode(text.trim());
    } catch {
      setMsg("클립보드 접근이 차단되었어요. 직접 입력해 주세요.");
    }
  };

  // 쿼리 code 있으면 위 useEffect가 처리하므로, 여기선 안내/수동 입력 UI를 노출
  return (
    <main style={{ padding: 24 }}>
      <h1>QR 스캔</h1>

      {!codeFromQS && (
        <>
          <p style={{ marginTop: 8 }}>
            <b>권장:</b> 휴대폰 <b>카메라 앱</b>으로 부스 QR을 스캔하면 자동으로 처리됩니다.
            <br/>문제가 있으면 아래에 <b>코드를 직접 입력</b>해 주세요.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: ABC123"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%", maxWidth: 360, padding: 12,
                border: "1px solid #ddd", borderRadius: 8
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="submit"
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                코드로 처리
              </button>
              <button
                type="button"
                onClick={pasteFromClipboard}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                붙여넣기
              </button>
              <a href="/me" style={{ alignSelf: "center", marginLeft: 8, textDecoration: "underline" }}>
                내 활동으로
              </a>
            </div>
          </form>
        </>
      )}

      <p style={{ marginTop: 12, color: "#666" }}>
        {codeFromQS ? "QR 코드를 처리 중입니다..." : (msg || "")}
      </p>
    </main>
  );
}
