"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");      // ✅ 주소 추가
  const [org, setOrg] = useState("");
  const [phone, setPhone] = useState("");          // 읽기 전용 노출

  useEffect(() => {
    (async () => {
      try {
        // 로그인 확인
        const me = await fetch("/api/me").then(r => r.json()).catch(() => null);
        if (!me?.user?.id) {
          const next = encodeURIComponent("/profile");
          location.href = `/login?next=${next}`;
          return;
        }
        setPhone(me?.user?.phone || me?.user?.user_metadata?.phone || "");

        // 프로필 불러오기
        const p = await fetch("/api/profile", { method: "GET" }).then(r => r.json());
        if (p?.ok && p.profile) {
          setName(p.profile.name || "");
          setAddress(p.profile.address || "");      // ✅ 주소 바인딩
          setOrg(p.profile.organization || "");
        }
      } catch (e) {
        setMsg("정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setMsg("이름과 주소는 필수입니다.");
      return;
    }
    setSaving(true);
    setMsg("저장 중…");
    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, organization: org }),
      }).then(r => r.json());
      if (!r.ok) throw new Error(r.error || "저장 실패");
      setMsg("저장되었습니다.");
      // 필요 시 me로 이동: router.replace("/me");
    } catch (e) {
      setMsg(e.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  if (loading) {
    return <main className="min-h-screen bg-[#FFF7E3] p-6">불러오는 중…</main>;
  }

  return (
    <main className="min-h-screen bg-[#FFF7E3] flex flex-col items-center px-6 py-10 text-[#1F2C5D]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 border border-[#E5E8DA]">
        <h1 className="text-2xl font-extrabold mb-6">내 정보</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 연락처(읽기전용) */}
          <div>
            <label className="block mb-1 font-medium">연락처 (읽기전용)</label>
            <input
              value={phone || ""}
              readOnly
              className="w-full p-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">이름 *</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A]
                         focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* ✅ 주소 필드 추가 */}
          <div>
            <label className="block mb-1 font-medium">주소 *</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A]
                         focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="주소를 입력하세요"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">소속 (선택)</label>
            <input
              className="w-full p-3 rounded-xl border border-[#A1E1A4] placeholder-[#7FB68A]
                         focus:ring-2 focus:ring-[#2843D1] focus:outline-none"
              placeholder="소속 단체나 기관을 입력하세요"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />
          </div>

          {msg && (
            <p
              className={`text-sm text-center ${
                msg.includes("오류") || msg.includes("필수") ? "text-[#2843D1]" : "text-[#27A36D]"
              }`}
            >
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#27A36D] text-white font-semibold shadow-sm
                       hover:scale-[1.02] transition disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full mt-3 py-3 rounded-xl bg-[#2843D1] text-white font-semibold shadow-sm hover:opacity-95"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}