// src/app/register/page.js
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [org, setOrg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      alert("이름과 주소는 필수입니다.");
      return;
    }
    const r = await fetch("/api/profile", {
      method: "PUT", // 이미 있는 profile API 재사용(없으면 POST로 동일 처리)
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, organization: org }),
    }).then(r => r.json());

    if (!r.ok) {
      alert(r.error || "저장 실패");
      return;
    }
    router.replace("/me");
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">회원 정보 입력</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block mb-1">이름 *</label>
          <input className="w-full input" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1">주소 *</label>
          <input className="w-full input" value={address} onChange={e=>setAddress(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1">소속 (선택)</label>
          <input className="w-full input" value={org} onChange={e=>setOrg(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full mt-2">저장하고 시작하기</button>
      </form>
    </div>
  );
}
