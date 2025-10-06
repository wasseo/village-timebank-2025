"use client";

import Link from "next/link"; // ✅ 추가

export default function NavBar() {
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  return (
    <header className="p-4 border-b mb-4 flex gap-4">
      {/* ✅ a → Link 로 교체 */}
      <Link className="underline" href="/">홈</Link>
      <Link className="underline" href="/profile">내 정보</Link>
      <Link className="underline" href="/me">내 활동</Link>

      {/* 로그아웃 버튼은 그대로 */}
      <button className="ml-auto underline" onClick={logout}>
        로그아웃
      </button>
    </header>
  );
}
