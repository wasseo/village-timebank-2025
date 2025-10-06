// src/app/api/profile-check/route.ts  (새 파일)
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET() {
  const session = await getIronSession<{ user?: { id: string } }>(
    cookies() as any,
    sessionOptions as any
  );
  const uid = session.user?.id;
  if (!uid) {
    return new Response(JSON.stringify({ redirectTo: "/login" }), { status: 200 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("name, address")
    .eq("id", uid)
    .single();

  if (error) {
    // 에러면 일단 등록 페이지로 유도
    return new Response(JSON.stringify({ redirectTo: "/register" }), { status: 200 });
  }

  const needsRegister = !data?.name || !data?.address; // 이름+주소 필수
  return new Response(
    JSON.stringify({ redirectTo: needsRegister ? "/register" : "/me" }),
    { status: 200 }
  );
}
