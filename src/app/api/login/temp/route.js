// /src/app/api/login/temp/route.js

import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

export async function POST(req) {
    const res = new NextResponse();
    // 세션은 로그인 전에 필요하므로 먼저 가져옵니다.
    const session = await getIronSession(req, res, sessionOptions);

    try {
        const body = await req.json().catch(() => ({}));

        const { phone, temp_code } = body;

        // 1. 기본 입력값 검증
        if (!phone || !temp_code) {
            return NextResponse.json({ ok: false, error: "핸드폰 번호와 임시 코드가 모두 필요합니다." }, { status: 400 });
        }
        
        const normalizedPhone = phone.replace(/[^0-9]/g, '');

        // --- 1단계: 사용자 ID 조회 (Profiles 테이블) ---
        const { data: profile, error: profileErr } = await admin
            .from('profiles')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();
        
        if (profileErr) throw profileErr;
        
        if (!profile) {
            return NextResponse.json({ ok: false, error: "등록된 사용자 정보가 없습니다." }, { status: 404 });
        }
        
        const user_id = profile.id;

        // --- 2단계: 임시 코드 검증 (onboard_codes 테이블) ---
        const { data: codeData, error: codeErr } = await admin
            .from('onboard_codes')
            .select('code, expires_at')
            .eq('user_id', user_id)
            .eq('code', temp_code)
            .order('created_at', { ascending: false }) // 최신 코드를 우선적으로 확인
            .limit(1)
            .maybeSingle();

        if (codeErr) throw codeErr;

        if (!codeData) {
            return NextResponse.json({ ok: false, error: "임시 코드가 일치하지 않습니다." }, { status: 401 });
        }

        // 2.1. 코드 만료 시간 검증
        const isExpired = new Date(codeData.expires_at).getTime() < Date.now();
        if (isExpired) {
            // 만료된 코드는 삭제 후 에러 반환 (선택적 보안 강화)
            await admin.from('onboard_codes').delete().eq('user_id', user_id);
            return NextResponse.json({ ok: false, error: "임시 코드가 만료되었습니다. 운영진에게 다시 요청해주세요." }, { status: 401 });
        }

        // --- 3단계: 로그인 성공 및 세션 발급 ---
        
        // 3.1. 보안 강화: 사용된 임시 코드를 즉시 삭제하여 재사용을 방지합니다.
        await admin
            .from('onboard_codes')
            .delete()
            .eq('user_id', user_id);

        // 3.2. 세션에 사용자 ID 저장 (핵심)
        session.user = { id: user_id };
        await session.save(); // iron-session에 세션 저장 (브라우저에 쿠키 발급)

        // 3.3. 최종 응답
        return NextResponse.json({ 
            ok: true, 
            message: "임시 코드로 로그인 성공",
            user_id: user_id,
        }, { headers: res.headers });

    } catch (e) {
        console.error("[/api/login/temp] ERROR:", e);
        return NextResponse.json(
            { ok: false, error: e.message || "server error" },
            { status: 500 }
        );
    }
}