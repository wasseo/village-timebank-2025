"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const to3 = (v) => String(v || "").replace(/\D/g, "").slice(0,3).padStart(3,"0");

async function ensureSession() {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    ({ data: { session } } = await supabase.auth.getSession());
  }
  return session; // session.user.id 사용
}

export default function RegisterPage() {
  const router = useRouter();
  const [num, setNum] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        const uid = session.user.id;

        const { data } = await supabase
          .from("profiles").select("participant_number").eq("id", uid).maybeSingle();
        if (data?.participant_number) setNum(data.participant_number);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const session = await ensureSession();
      const uid = session.user.id;

      const clean = to3(num);
      if (!clean || clean === "000") { setMsg("001~999 숫자만"); return; }

      const { data: exists } = await supabase
        .from("profiles").select("id").eq("participant_number", clean).maybeSingle();
      if (exists && exists.id !== uid) { setMsg("이미 사용 중인 번호"); return; }

      const { error } = await supabase
        .from("profiles").upsert({ id: uid, participant_number: clean });
      if (error) throw error;

      setMsg("저장 완료!"); router.replace("/me");
    } catch (err) {
      setMsg("저장 실패: " + (err?.message || "unknown"));
    }
  };

  if (loading) return <main style={{padding:24}}>불러오는 중...</main>;

  return (
    <main style={{maxWidth:420, margin:"60px auto", padding:24}}>
      <h1 style={{fontSize:24, marginBottom:12}}>참가 번호 등록</h1>
      <form onSubmit={save}>
        <input
          value={num}
          onChange={(e)=>setNum(to3(e.target.value))}
          placeholder="예: 001"
          inputMode="numeric"
          style={{width:"100%", padding:12, fontSize:18, textAlign:"center", letterSpacing:2}}
        />
        <button type="submit" style={{marginTop:12, width:"100%", padding:12}}>저장</button>
      </form>
      <p style={{marginTop:8, color:"#475569"}}>{msg}</p>
    </main>
  );
}