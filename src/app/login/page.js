//src/app/login/page.js

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic"; // CSR 강제

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

    // 🔑 새로운 상태: 로그인 모드 ('sms' 또는 'temp')
    const [loginMode, setLoginMode] = useState('sms');

    const [phone, setPhone] = useState("");
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState("");
    const [msg, setMsg] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const [isSending, setIsSending] = useState(false);
    
    // 🔑 임시 코드 전용 상태
    const [tempCode, setTempCode] = useState(""); // 임시 코드 입력 값

    // --- 기존 로그인 상태 확인 및 리다이렉션 로직 ---
    useEffect(() => {
        (async () => {
            try {
                const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
                if (me?.user) {
                    const pc = await fetch("/api/profile-check").then((r) => r.json());
                    // 프로필 확인 후 리다이렉션 (기존 로직 유지)
                    location.href = pc.redirectTo === "/register" ? "/register" : next;
                }
            } catch {}
        })();
    }, [next]);

    // --- 쿨다운 타이머 로직 ---
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    // --- SMS 인증번호 요청 함수 (기존 로직 유지) ---
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
            const wait = Number(j.resend_after ?? 60);
            setCooldown(wait);
            setMsg("인증번호를 보냈습니다. 문자 메시지를 확인해 주세요.");
            navigator.vibrate?.(30);
        } catch (e) {
            setMsg(e.message || "전송 실패. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsSending(false);
        }
    };

    // --- SMS 인증 확인 함수 (기존 로직 유지) ---
    const verify = async () => {
        setMsg("");
        const r = await fetch("/api/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, code }),
        });
        const j = await r.json();
        if (!j.ok) return setMsg(j.error || "인증 실패");

        // 로그인 성공 후 리다이렉션 로직 (기존 유지)
        try {
            const pc = await fetch("/api/profile-check").then((r) => r.json());
            location.href = pc.redirectTo === "/register" ? "/register" : next;
        } catch {
            location.href = "/me";
        }
    };
    
    // --- 🔑 임시 코드 로그인 함수 (새로운 로직) ---
    const verifyTempCode = async () => {
        setMsg("");
        if (!phone || !tempCode) return setMsg("번호와 코드를 모두 입력해주세요.");

        const r = await fetch("/api/login/temp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, temp_code: tempCode }),
        });
        const j = await r.json();
        
        if (!r.ok || !j.ok) {
            return setMsg(j.error || "로그인 실패. 코드가 만료되었거나 틀렸습니다.");
        }
        
        // 로그인 성공 후 리다이렉션 로직 (verify 함수와 동일)
        try {
            const pc = await fetch("/api/profile-check").then((r) => r.json());
            location.href = pc.redirectTo === "/register" ? "/register" : next;
        } catch {
            location.href = "/me";
        }
    };

    // --- 폼 렌더링 ---
    const renderSmsForm = () => (
        <>
            <input
                className="w-full p-3 rounded-xl border border-[#A1E1A4] focus:outline-none focus:ring-2 focus:ring-[#2843D1] placeholder-[#7FB68A]"
                placeholder="휴대폰 번호 (예: 01012345678)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={sent}
            />

            {!sent ? (
                <button
                    onClick={request}
                    disabled={isSending || cooldown > 0 || !phone}
                    className={`w-full p-3 rounded-xl text-white font-semibold bg-[#2843D1] shadow-md transition ${
                        isSending || cooldown > 0 || !phone ? "opacity-60" : "hover:scale-[1.02]"
                    }`}
                >
                    {isSending
                        ? "발송 중…"
                        : cooldown > 0
                        ? `${cooldown}s 후 재전송`
                        : "인증번호 발송"}
                </button>
            ) : (
                <>
                    <input
                        className="w-full p-3 rounded-xl border border-[#A1E1A4] focus:outline-none focus:ring-2 focus:ring-[#2843D1]"
                        placeholder="인증코드 6자리"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <button
                        onClick={verify}
                        className="w-full p-3 rounded-xl text-white font-semibold bg-[#27A36D] shadow-md hover:scale-[1.02] transition"
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
                className="w-full p-3 rounded-xl border border-[#A1E1A4] focus:outline-none focus:ring-2 focus:ring-[#2843D1] placeholder-[#7FB68A]"
                placeholder="휴대폰 번호 (운영진 등록 번호)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSending}
            />
            <input
                className="w-full p-3 rounded-xl border border-[#A1E1A4] focus:outline-none focus:ring-2 focus:ring-[#2843D1] placeholder-[#7FB68A]"
                placeholder="운영진이 발급한 임시 코드"
                value={tempCode}
                onChange={(e) => setTempCode(e.target.value)}
                disabled={isSending}
            />
            <button
                onClick={verifyTempCode}
                disabled={isSending || !phone || !tempCode}
                className={`w-full p-3 rounded-xl text-white font-semibold bg-[#2843D1] shadow-md transition ${
                    isSending || !phone || !tempCode ? "opacity-60" : "hover:scale-[1.02]"
                }`}
            >
                {isSending ? "로그인 처리 중..." : "임시 코드로 로그인"}
            </button>
        </>
    );

    return (
        <main className="min-h-screen bg-[#FFF7E3] text-[#1F2C5D] flex flex-col justify-center items-center px-6">
            {/* 상단 헤더 */}
            <div className="text-center mb-10">
                <div className="text-[40px] font-extrabold text-[#27A36D] leading-none">2025</div>
                <div className="text-[34px] font-extrabold text-[#27A36D] leading-none mt-1">경기마을주간</div>
                <div className="text-xl text-[#223D8F] mt-2">10.18(토) – 10.19(일)</div>
            </div>

            {/* 아이콘 */}
            <ClockHouseIcon className="w-28 h-28 text-[#27A36D] mb-6" />

            {/* 제목 */}
            <h1 className="text-3xl font-extrabold mb-2">마을 시간은행</h1>
            <p className="text-base text-[#223D8F] mb-8">휴대폰 번호로 로그인</p>

            {/* 🔑 로그인 모드 선택 탭 */}
            <div className="flex w-full max-w-xs mb-4 p-1 bg-white rounded-xl shadow-inner border border-[#A1E1A4]/50">
                <button
                    onClick={() => setLoginMode('sms')}
                    className={`flex-1 p-2 rounded-lg font-semibold text-sm transition ${
                        loginMode === 'sms' 
                        ? 'bg-[#2843D1] text-white shadow-md' 
                        : 'text-[#2843D1] hover:bg-[#2843D1]/10'
                    }`}
                >
                    문자 인증 로그인
                </button>
                <button
                    onClick={() => setLoginMode('temp')}
                    className={`flex-1 p-2 rounded-lg font-semibold text-sm transition ${
                        loginMode === 'temp' 
                        ? 'bg-[#27A36D] text-white shadow-md' 
                        : 'text-[#27A36D] hover:bg-[#27A36D]/10'
                    }`}
                >
                    운영진 코드 로그인
                </button>
            </div>


            {/* 입력 영역 */}
            <div className="w-full max-w-xs space-y-3">
                {loginMode === 'sms' ? renderSmsForm() : renderTempCodeForm()}

                {msg && <p className="text-sm text-[#2843D1] mt-2 text-center">{msg}</p>}
            </div>

            {/* 하단 로고 */}
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

/** 시계+집 아이콘 (SVG) */
function ClockHouseIcon({ className = "" }) {
    return (
        <svg viewBox="0 0 128 128" className={className} fill="none">
            <g fill="currentColor">
                <circle cx="54" cy="50" r="28" fill="currentColor" opacity="0.18" />
                <circle cx="54" cy="50" r="24" fill="currentColor" opacity="0.25" />
                <circle cx="54" cy="50" r="20" fill="#FFF" />
                <circle cx="54" cy="50" r="18" stroke="currentColor" strokeWidth="2" fill="none"/>
                <rect x="52.5" y="38" width="3" height="12" rx="1.5" fill="currentColor"/>
                <rect x="54" y="50" width="10" height="3" rx="1.5" fill="currentColor" transform="rotate(45 54 50)"/>
                <path d="M74 56l22-16 22 16v34a6 6 0 0 1-6 6H80a6 6 0 0 1-6-6V56z" fill="currentColor" />
                <rect x="92" y="82" width="8" height="14" rx="1.5" fill="#FFF"/>
                <rect x="98" y="66" width="8" height="8" fill="#FFF"/>
            </g>
        </svg>
    );
}