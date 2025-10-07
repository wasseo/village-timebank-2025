// src/app/scan/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

/* ---------- 로컬 스토리지 헬퍼 ---------- */
const PENDING_KEY = "pendingScan";
const savePending = (p) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch {} };
const readPending  = () => { try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null } };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

/* ---------- URL 파라미터 → payload 매핑 ---------- */
function pickPayloadFromLocation() {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const code = (sp.get("code") || sp.get("c") || "").trim();
  const b    = (sp.get("b") || sp.get("booth_id") || "").trim();
  const e    = (sp.get("e") || "").trim();
  if (!code && !b) return null;
  const payload = {};
  if (code) payload.code = code;
  if (b) payload.b = b;
  if (e) payload.client_event_id = e;
  return payload;
}

/* ---------- 텍스트(any) → payload 파싱 ---------- */
function parseAnyText(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (t.startsWith("tb://")) {
    try {
      const u = new URL(t);
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      const boothId = parts[1] || "";
      const k = (u.searchParams.get("k") || "earn").toLowerCase();
      const amt = Number(u.searchParams.get("amt") || 1);
      if (!boothId) return null;
      return { b: boothId, kind: k === "redeem" ? "redeem" : "earn", amount: Math.max(1, amt) };
    } catch {}
  }
  if (/^booth[-_]/i.test(t)) return { b: t };
  return { code: t };
}

/* ---------- iOS / Safari / PWA(standalone) 감지 ---------- */
function getIOSContext() {
  if (typeof window === "undefined") return { isIOS: false, isStandalone: false, isSafari: false };
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  // PWA/홈화면 모드 감지
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  // 사파리 감지: 크롬/앱웹뷰를 제외
  const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|OPiOS/i.test(ua);
  return { isIOS, isStandalone, isSafari };
}

export default function ScanPage() {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [torch, setTorch] = useState(false);
  const [msg, setMsg] = useState("카메라 준비 중…");
  const [last, setLast] = useState(null);
  const [manual, setManual] = useState("");

  // 카메라 선택/상태
  const [devices, setDevices] = useState([]); // [{id, label}]
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);

  // iOS UX 안내 플래그
  const [{ isIOS, isStandalone, isSafari }, setIOSCtx] = useState({ isIOS: false, isStandalone: false, isSafari: true });

  // 전송 가드: 짧은 쿨타임 & 중복 전송 방지
  const sendingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // 로그인 후 자동복귀 처리
  useEffect(() => {
    setIOSCtx(getIOSContext());
    (async () => {
      const urlSp = new URLSearchParams(location.search);
      if (urlSp.get("auto") !== "1") return;

      const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
      if (!me?.user?.id) return;

      const pending = readPending();
      if (!pending) return;

      setMsg("이전 스캔 자동 처리 중…");
      await sendToServer(pending);
    })();
  }, []);

  // 장치 목록 새로고침
  const refreshDevices = async () => {
    try {
      const cams = await QrScanner.listCameras(true); // [{id, label}]
      setDevices(cams);
      const saved = localStorage.getItem("vtb:lastDeviceId");
      if (saved && cams.some(c => c.id === saved)) {
        setDeviceId(saved);
      } else if (cams.length && !deviceId) {
        setDeviceId(cams[0].id);
      }
    } catch (e) {
      console.warn("카메라 목록 불러오기 실패", e);
    }
  };

  // 스캐너 시작
  useEffect(() => {
    let active = true;

    (async () => {
      const fromUrl = pickPayloadFromLocation();
      if (fromUrl) {
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          savePending(fromUrl);
          location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
          return;
        }
        setMsg("전송 중…");
        await sendToServer(fromUrl);
        return;
      }

      try {
        setLoading(true);

        const scanner = new QrScanner(
          videoRef.current,
          result => {
            if (!active) return;
            const text = result?.data || result;
            // 쿨다운/전송 중이면 무시 (중복 방지)
            if (sendingRef.current || cooldown > 0) return;
            handleScanResult(text);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        scannerRef.current = scanner;

        await scanner.start();           // 권한 요청 + 비디오 attach
        await refreshDevices();          // 라벨 활성화 후 목록 로드

        const saved = localStorage.getItem("vtb:lastDeviceId");
        if (saved) {
          try {
            await scanner.setCamera(saved);
            setDeviceId(saved);
          } catch (e) {
            console.warn("저장된 카메라 전환 실패 → 기본 유지", e);
          }
        }

        setMsg("QR을 화면 중앙에 맞춰주세요.");
      } catch (e) {
        console.warn(e);
        setMsg("카메라 접근이 거부되었거나 사용할 수 없습니다.");
      } finally {
        setLoading(false);
      }
    })();

    const onDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [cooldown]);

  // 카메라 전환
  const handleChangeDevice = async (id) => {
    setDeviceId(id || null);
    if (!scannerRef.current) return;
    try {
      setLoading(true);
      setMsg("카메라 전환 중…");
      await scannerRef.current.setCamera(id); // deviceId 또는 'environment'/'user'
      if (id) localStorage.setItem("vtb:lastDeviceId", id);
      else localStorage.removeItem("vtb:lastDeviceId");
      setMsg("QR을 화면 중앙에 맞춰주세요.");
    } catch (e) {
      console.warn("카메라 전환 실패", e);
      setMsg("선택한 카메라를 사용할 수 없습니다. 다른 장치를 선택해 주세요.");
      try {
        await scannerRef.current.setCamera("environment");
        setMsg("후면 카메라로 폴백했습니다. 다시 시도해 주세요.");
      } catch {
        try {
          await scannerRef.current.setCamera("user");
          setMsg("전면 카메라로 폴백했습니다. 다시 시도해 주세요.");
        } catch {
          setMsg("폴백 실패: 브라우저 권한/HTTPS/다른 앱 점유를 확인해 주세요.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // 플래시 토글
  async function toggleTorch() {
    try {
      const has = await scannerRef.current?.hasFlash();
      if (!has) return alert("해당 기기는 플래시를 지원하지 않습니다.");
      if (torch) await scannerRef.current?.turnFlashOff();
      else await scannerRef.current?.turnFlashOn();
      setTorch(!torch);
    } catch {
      alert("플래시 제어를 사용할 수 없습니다.");
    }
  }

  // 스캔 처리
  async function handleScanResult(text) {
    const payload = parseAnyText(text);
    if (!payload) {
      setMsg("QR 형식이 올바르지 않습니다.");
      return;
    }
    const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
    if (!me?.user?.id) {
      savePending(payload);
      location.href = `/login?next=${encodeURIComponent("/scan?auto=1")}`;
      return;
    }
    setMsg("전송 중…");
    await sendToServer(payload);
  }

  // 서버 전송(멱등 + 쿨타임)
  async function sendToServer(payload) {
    if (sendingRef.current || cooldown > 0) return; // 중복 방지
    sendingRef.current = true;
    setCooldown(2); // 2초 쿨다운
    setLast(payload);

    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, client_event_id: crypto.randomUUID?.() }),
      });

      if (r.status === 429) { // 레이트리밋 → 짧게 대기 후 1회 재시도
        await new Promise(res => setTimeout(res, 500));
        sendingRef.current = false;
        return await sendToServer(payload);
      }

      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        clearPending();
        setMsg(j.duplicated
          ? "이미 처리된 QR입니다. /me로 이동합니다…"
          : "활동이 추가되었습니다. /me로 이동합니다…"
        );
        setTimeout(() => (location.href = "/me"), 900);
      } else {
        setMsg(`실패: ${j.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      setMsg(`에러: ${e.message || "요청 실패"}`);
    } finally {
      sendingRef.current = false;
    }
  }

  // 이미지 업로드 스캔
  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await QrScanner.scanImage(f, { returnDetailedScanResult: false });
      await handleScanResult(text);
    } catch {
      setMsg("이미지에서 QR을 읽지 못했습니다.");
    }
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">QR 스캔</h1>

      {/* iPhone 최적화 안내 (Safari 권장 + PWA 경고) */}
      {isIOS && (
        <div className="text-xs rounded-lg border p-3 bg-amber-50 border-amber-200 text-amber-900">
          {!isSafari && (
            <p>iPhone에서는 <b>Safari 브라우저</b>에서 카메라 스캔이 가장 안정적으로 작동합니다.</p>
          )}
          {isStandalone && (
            <p className="mt-1">현재 <b>홈 화면(PWA) 모드</b>로 보이는 것 같아요. 카메라 권한 팝업이 표시되지 않을 수 있습니다. 문제가 있다면 Safari에서 직접 열어주세요.</p>
          )}
        </div>
      )}

      {/* 카메라 선택/제어 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-600">카메라</label>
        <select
          className="border rounded px-3 py-2"
          value={deviceId || ""}
          onChange={(e) => handleChangeDevice(e.target.value || null)}
          disabled={loading}
        >
          <option value="">자동 선택(후면 우선)</option>
          {devices.map((d, i) => (
            <option key={d.id || `cam-${i}`} value={d.id}>
              {d.label || `카메라 ${i + 1}`}
            </option>
          ))}
        </select>
        <button
          className="border rounded px-3 py-2"
          onClick={() => handleChangeDevice(deviceId || "")}
          disabled={loading}
        >
          다시 시도
        </button>
        <button className="border rounded px-3 py-2" onClick={toggleTorch}>
          {torch ? "플래시 끄기" : "플래시 켜기"}
        </button>

        {/* 쿨다운 표시 */}
        {cooldown > 0 && (
          <span className="text-xs px-2 py-1 rounded border bg-gray-50 text-gray-700">
            {cooldown}s 대기 중…
          </span>
        )}
      </div>

      {/* 카메라 프리뷰 */}
      <div className="relative rounded-2xl overflow-hidden border">
        <video
          ref={videoRef}
          className="w-full aspect-[3/4] object-cover bg-black"
          muted
          playsInline
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-black/30">
            카메라 로딩 중…
          </div>
        )}
      </div>

      {/* 액션 버튼들 */}
      <div className="flex gap-2">
        <label className="border rounded px-3 py-2 cursor-pointer">
          이미지에서 스캔
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        <a href="/me" className="border rounded px-3 py-2 inline-flex items-center">내 활동</a>
      </div>

      {/* 수동 입력 백업 */}
      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="코드 또는 booth-xxx 또는 tb://booth/.."
          className="border rounded px-3 py-2 w-full"
        />
        <button
          className="border rounded px-3 py-2"
          onClick={() => (sendingRef.current || cooldown > 0) ? null : handleScanResult(manual)}
          disabled={cooldown > 0}
        >
          입력 처리
        </button>
      </div>

      {/* 상태/마지막 처리 */}
      <div className="space-y-1">
        <div className="text-sm text-gray-600">{msg}</div>
        {last && (
          <div className="text-xs text-gray-500 break-all">
            마지막 처리: {JSON.stringify(last)}
          </div>
        )}
      </div>
    </div>
  );
}
