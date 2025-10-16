// /src/app/api/admin/onboard/route.js

import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session'; // 기존 세션 설정 파일
import { createClient } from "@supabase/supabase-js";

// iron-session을 사용하므로 runtime은 nodejs로 지정
export const runtime = "nodejs";

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

// 임시 코드의 유효 시간 (분)
const TEMP_CODE_EXPIRY_MINUTES = 10; 

/** 5~6자리 숫자 코드를 생성합니다. */
function generateTempCode() {
    // 6자리 랜덤 숫자 문자열 생성 (000000 ~ 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
}

export async function POST(req) {
    const res = new NextResponse();
    const session = await getIronSession(req, res, sessionOptions);

    try {
        const body = await req.json().catch(() => ({}));

        const { phone, name } = body;

        // 1. 기본 입력값 검증
        if (!phone) {
            return NextResponse.json({ ok: false, error: "핸드폰 번호가 필요합니다." }, { status: 400 });
        }
        
        // --- 1단계: 운영진 권한 확인 ---
        // (세션에 user.id가 있어야 하고, 해당 user가 is_admin=true인지 확인해야 합니다.)
        if (!session.user?.id) {
            return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
        }
        
        // 1.1. 운영진 정보 조회 및 권한 확인
        const { data: adminProfile, error: adminErr } = await admin
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .maybeSingle();

        if (adminErr) throw adminErr;

        if (!adminProfile?.is_admin) {
             return NextResponse.json({ ok: false, error: "운영진 권한이 없습니다." }, { status: 403 });
        }
        // --- 운영진 권한 확인 끝 ---

        // 2. 기존 사용자 확인 및 생성
        let user_id;
        const normalizedPhone = phone.replace(/[^0-9]/g, ''); // 숫자만 남기기

        // 2.1. 기존 사용자 검색
        let { data: profile, error: profileErr } = await admin
            .from('profiles')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();
        
        if (profileErr) throw profileErr;

        if (profile) {
            // 이미 존재하는 사용자: ID 사용
            user_id = profile.id;
        } else {
            // 2.2. 새로운 사용자 생성 (profiles 테이블에 직접 INSERT)
            const { data: newProfile, error: newProfileErr } = await admin
                .from('profiles')
                .insert([{ phone: normalizedPhone, name: name || '운영진 등록 고객' }])
                .select('id')
                .maybeSingle();

            if (newProfileErr) throw newProfileErr;
            if (!newProfile) {
                 return NextResponse.json({ ok: false, error: "사용자 생성에 실패했습니다." }, { status: 500 });
            }
            user_id = newProfile.id; 
            // 참고: 이 시점에 신규 가입 보너스 트리거가 자동으로 실행됩니다!
        }
        
        // 3. 임시 코드 생성 및 저장
        const tempCode = generateTempCode();
        const expiresAt = new Date(Date.now() + TEMP_CODE_EXPIRY_MINUTES * 60000).toISOString();

        // 3.1. 기존 코드 제거 (보안 강화)
        // 해당 사용자의 기존 임시 코드가 있다면 모두 삭제합니다.
        await admin
            .from('onboard_codes')
            .delete()
            .eq('user_id', user_id);

        // 3.2. 새 코드 저장
        const { error: codeErr } = await admin
            .from('onboard_codes')
            .insert([{ user_id, code: tempCode, expires_at: expiresAt }]);

        if (codeErr) throw codeErr;

        // 4. 최종 응답
        return NextResponse.json({ 
            ok: true, 
            message: "계정 처리 및 임시 코드 발급 완료",
            code: tempCode,
            user_id: user_id,
            expires_at: expiresAt,
        });

    } catch (e) {
        console.error("[/api/admin/onboard] ERROR:", e);
        return NextResponse.json(
            { ok: false, error: e.message || "server error" },
            { status: 500 }
        );
    }
}