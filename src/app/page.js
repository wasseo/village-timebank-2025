// src/app/page.js
"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#7FD6FF] text-[#1F2C5D]">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-20 w-64 h-64 rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle at center, #FFFFFF 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-16 right-[-40px] w-52 h-52 rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle at center, #FFE6A7 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-[-40px] w-40 h-40 rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle at center, #FFFFFF 0%, transparent 70%)",
          }}
        />
        <Confetti />
      </div>

      {/* 메인 타이틀 */}
      <section className="relative z-10 text-center px-6">
        <h1 className="text-[72px] font-extrabold text-white leading-none drop-shadow-md">
          2025
        </h1>
        <h2 className="text-[42px] font-extrabold text-[#FF8F3C] mt-2 leading-none drop-shadow-md">
          마을데이터 챌린지
        </h2>
        <p className="mt-4 text-lg text-[#18426A] font-medium">
          마을의 문제를 함께 탐험하고, 데이터로 이야기하는 실험의 장
        </p>

        {/* 참가 버튼 */}
        <button
          onClick={() => router.push("/login")}
          className="mt-10 inline-flex items-center justify-center px-8 py-4 rounded-2xl text-lg font-semibold text-white bg-[#1F2C5D] shadow-lg active:scale-[0.97] transition-transform"
        >
          참가 신청하기
        </button>

        <p className="mt-3 text-sm text-[#1F2C5D]/80">
          로그인 후 신청서를 작성해 주세요
        </p>
      </section>

      {/* 하단 장식 */}
      <footer className="absolute bottom-8 right-8 opacity-70">
        <BusIcon className="w-12 h-12 text-[#FF8F3C]" />
      </footer>
    </main>
  );
}

/** 작은 컨페티 배경 요소 */
function Confetti() {
  const shapes = Array.from({ length: 12 });
  return (
    <>
      {shapes.map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-40"
          style={{
            backgroundColor: i % 2 ? "#FF8F3C" : "#FFFFFF",
            width: `${6 + (i % 3) * 3}px`,
            height: `${6 + (i % 3) * 3}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </>
  );
}

/** 심플한 버스 아이콘 */
function BusIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="10" y="16" width="44" height="28" rx="4" fill="currentColor" />
      <rect x="16" y="22" width="8" height="8" fill="#FFF" />
      <rect x="28" y="22" width="8" height="8" fill="#FFF" />
      <rect x="40" y="22" width="8" height="8" fill="#FFF" />
      <circle cx="20" cy="48" r="4" fill="#FFF" />
      <circle cx="44" cy="48" r="4" fill="#FFF" />
    </svg>
  );
}
