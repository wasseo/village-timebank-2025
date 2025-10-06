"use client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({ name: "", org: "", phone: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.profile) {
          setForm({
            name: d.profile.name ?? "",
            org: d.profile.org ?? "",
            phone: d.profile.phone ?? "",
          });
        } else {
          setMsg(d.error ?? "로그인이 필요합니다.");
          if (typeof window !== "undefined") location.href = "/login";
        }
      })
      .catch(() => setMsg("불러오기에 실패했습니다."));
  }, []);

  const save = async () => {
    setMsg("");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    setMsg(j.ok ? "저장되었습니다." : j.error || "저장 실패");
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">내 정보</h1>

      <label className="text-sm">이름</label>
      <input
        className="border w-full p-2 rounded"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />

      <label className="text-sm">소속</label>
      <input
        className="border w-full p-2 rounded"
        value={form.org}
        onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))}
      />

      <label className="text-sm">연락처</label>
      <input
        className="border w-full p-2 rounded"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
      />

      <button className="w-full p-2 rounded bg-black text-white mt-2" onClick={save}>
        저장
      </button>

      <p className="text-sm text-gray-600">{msg}</p>

      <button
        className="w-full p-2 rounded bg-gray-800 text-white"
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          location.href = "/login";
        }}
      >
        로그아웃
      </button>
    </div>
  );
}
