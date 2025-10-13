// src/app/page.js
"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#FFF7E3] text-[#1F2C5D]">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-20"
             style={{background: "radial-gradient(circle at center, #8F8AE6 0%, transparent 60%)"}}/>
        <div className="absolute top-16 right-10 w-28 h-28 rounded-full opacity-20"
             style={{background: "radial-gradient(circle at center, #27A36D 0%, transparent 60%)"}}/>
        <div className="absolute bottom-24 left-8 w-24 h-24 rounded-full opacity-10"
             style={{background: "radial-gradient(circle at center, #2843D1 0%, transparent 60%)"}}/>
      </div>

      {/* 상단: 행사 정보 */}
      <header className="px-5 pt-6">
        <div className="inline-block">
          <div className="text-[40px] leading-none font-extrabold text-[#27A36D] tracking-tight">
            2025
          </div>
          <div className="mt-1 text-[34px] leading-none font-extrabold text-[#27A36D] tracking-tight">
            경기마을주간
          </div>
          <div className="mt-2 text-xl font-semibold text-[#1F2C5D]">
            10.18(토) – 10.19(일)
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 mt-8">
        {/* 아이콘 (시계+집) */}
        <ClockHouseIcon className="w-28 h-28 text-[#27A36D]" />

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight">
          마을 시간은행
        </h1>

        <p className="mt-3 text-lg text-[#223D8F]">휴대폰 번호로 시작해요</p>

        <button
          onClick={() => router.push("/login")}
          className="mt-8 inline-flex items-center justify-center rounded-2xl px-6 py-4 text-base font-semibold text-white bg-[#2843D1] shadow-sm active:scale-[0.98] transition"
        >
          휴대폰 번호로 시작하기
        </button>
      </section>

      {/* 하단 로고/푸터 */}
      <footer className="absolute bottom-6 left-0 right-0 flex justify-center px-6">
        {/* 실제 로고 이미지가 있으면 <img src="/logos/gmccsc.png" ...>로 교체 */}
        <div className="flex items-center gap-2 opacity-90">
          <span className="inline-block w-6 h-[6px] rounded-sm bg-[#27A36D]" />
          <span className="inline-block w-6 h-[6px] rounded-sm bg-[#27A36D]" />
          <span className="ml-2 text-sm font-medium text-[#1F2C5D]">
            경기도마을공동체지원센터
          </span>
        </div>
      </footer>
    </main>
  );
}

/** 시계+집 아이콘 (SVG) */
function ClockHouseIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 128 128" className={className} fill="none">
      <g fill="currentColor">
        {/* 시계 원형 */}
        <circle cx="54" cy="50" r="28" fill="currentColor" opacity="0.18" />
        <circle cx="54" cy="50" r="24" fill="currentColor" opacity="0.25" />
        <circle cx="54" cy="50" r="20" fill="#FFF" />
        {/* 시계 눈금/바늘 */}
        <circle cx="54" cy="50" r="18" stroke="currentColor" strokeWidth="2" fill="none"/>
        <rect x="52.5" y="38" width="3" height="12" rx="1.5" fill="currentColor"/>
        <rect x="54" y="50" width="10" height="3" rx="1.5" fill="currentColor" transform="rotate(45 54 50)"/>
        {/* 잎/받침 */}
        <path d="M30 74c10 0 16 4 20 10H28c-6 0-10-4-10-8s4-4 12-2z" fill="currentColor" opacity="0.25"/>
        {/* 집 */}
        <path d="M74 56l22-16 22 16v34a6 6 0 0 1-6 6H80a6 6 0 0 1-6-6V56z" fill="currentColor" />
        <rect x="92" y="82" width="8" height="14" rx="1.5" fill="#FFF"/>
        <rect x="98" y="66" width="8" height="8" fill="#FFF"/>
      </g>
    </svg>
  );
}