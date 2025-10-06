"use client";

export default function NavBar() {
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  return (
    <header className="p-4 border-b mb-4 flex gap-4">
      <a className="underline" href="/">홈</a>
      <a className="underline" href="/profile">내 정보</a>
      <a className="underline" href="/me">내 활동</a>
      <button className="ml-auto underline" onClick={logout}>
        로그아웃
      </button>
    </header>
  );
}
