import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { genCode, hashCode } from "@/lib/crypto";
import { sendSmsViaSolapi } from "@/lib/solapi";

// 숫자만 8~20 자리로 제한
const schema = z.object({
  phone: z.string().regex(/^\d{8,20}$/, "전화번호 형식이 올바르지 않습니다."),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스키(서버에서만)
);

export async function POST(req: Request) {
  try {
    // 1) 입력 정리: 문자열화 → trim → 숫자만 추출
    const raw = await req.json();
    const cleaned = String(raw?.phone ?? "").trim().replace(/\D/g, "");

    // 2) 검증
    const { phone } = schema.parse({ phone: cleaned });

    // 3) 레이트리밋(최근 60초)
    const { data: recent } = await supabase
      .from("otp_codes")
      .select("id, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent?.[0]) {
      const diffMs = Date.now() - new Date(recent[0].created_at).getTime();
      if (diffMs < 60_000) {
        return NextResponse.json(
          { ok: false, error: "잠시 후 다시 시도해주세요." },
          { status: 429 }
        );
      }
    }

    // 4) 코드 생성 & 저장
    const code = genCode(6);
    const codeHash = hashCode(code);
    const ttl = Number(process.env.OTP_CODE_TTL_SEC ?? "180");
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const { error } = await supabase.from("otp_codes").insert({
      phone,              // 숫자만 저장(권장)
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (error) throw error;

    // 5) 문자 발송 (Solapi)
    await sendSmsViaSolapi(
      phone,
      `[시간은행] 인증번호 ${code} (유효 ${Math.floor(ttl / 60)}분)`
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "fail" },
      { status: 400 }
    );
  }
}
