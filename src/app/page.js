// src/app/page.js
"use client";
import { useRouter } from "next/navigation";
export default function Home() {
  const router = useRouter();
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">마을 시간은행</h1>
      <button className="btn-primary px-6 py-3" onClick={()=>router.push("/login")}>
        휴대폰 번호로 시작하기
      </button>
    </div>
  );
}
