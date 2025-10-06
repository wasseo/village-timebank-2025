// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";


type UserSession = { user?: { id: string; phone: string } };

export async function GET(req: Request) {
  const res = new NextResponse();

  // ✅ 제너릭으로 세션 타입을 지정
  const session = await getIronSession<UserSession>(req, res, sessionOptions);

  return NextResponse.json(
    { user: session.user ?? null },
    { headers: res.headers }
  );
}
