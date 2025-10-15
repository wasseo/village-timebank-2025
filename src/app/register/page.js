// src/app/register/page.js
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [org, setOrg] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setMsg("이름과 주소는 필수입니다.");
      return;
    }

    setMsg("저장 중…");

    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, organization: org }),
      }).then(r => r.json());

      if (!r.ok) throw new Error(r.error || "저장 실패");
      router.replace("/me");
    } catch (e) {
      setMsg(e.message || "저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF7E3] flex flex-col justify-center items-center px-6 text-[#1F2C5D]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6 border border-[#E5E8DA]">
        {/* 타이틀 */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-2 text-[#1F2C5D]">
            회원 정보 입력
          </h1>
          <p className="text-[#2843D1] text-sm">
            마음시간은행에 참여할 기본 정보를 입력해주세요.
          </p>
        </div>

        {/* 입력 폼 */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">이름 *</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A] focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">활동 시군명 *</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A] focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="활동 시군명을 입력하세요"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">소속 (선택)</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A] focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="소속 단체나 기관을 입력하세요"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />
          </div>

          {/* 메시지 */}
          {msg && (
            <p
              className={`text-sm text-center ${
                msg.includes("오류") || msg.includes("필수")
                  ? "text-[#2843D1]"
                  : "text-[#27A36D]"
              }`}
            >
              {msg}
            </p>
          )}

          {/* 버튼 */}
          <button
            type="submit"
            className="w-full py-3 mt-2 rounded-xl bg-[#2843D1] text-white font-semibold shadow-sm hover:scale-[1.02] transition"
          >
            저장하고 시작하기
          </button>
        </form>
      </div>

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