import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { hashCode } from "@/lib/crypto";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export const runtime = "nodejs"; // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

const schema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const { phone, code } = schema.parse(await req.json());
    const codeHash = hashCode(code);

    // 🔹 1. 최근 코드 확인
    const { data, error } = await supabase
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempt_count, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data?.[0]) throw new Error("코드를 먼저 요청해주세요.");
    const row = data[0];
    if (new Date(row.expires_at).getTime() < Date.now())
      throw new Error("코드가 만료되었습니다.");
    if ((row.attempt_count ?? 0) >= 5)
      throw new Error("시도 횟수를 초과했습니다.");

    // 🔹 2. 코드 일치 여부 확인
    const ok = row.code_hash === codeHash;
    await supabase
      .from("otp_codes")
      .update({ attempt_count: (row.attempt_count ?? 0) + 1 })
      .eq("id", row.id);
    if (!ok) throw new Error("코드가 일치하지 않습니다.");

    // 🔹 3. 프로필 생성 또는 확인
    const { data: exists } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .limit(1);
    let userId = exists?.[0]?.id;
    if (!userId) {
      const ins = await supabase
        .from("profiles")
        .insert({ phone })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      userId = ins.data.id;
    }

    // 🔹 4. iron-session 저장
    const session = await getIronSession<{ user?: { id: string; phone: string } }>(
      cookies() as any,
      sessionOptions as any
    );
    session.user = { id: userId!, phone };
    await session.save();

    return NextResponse.json({ ok: true, user: session.user });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message ?? "verify failed" },
      { status: 400 }
    );
  }
}
