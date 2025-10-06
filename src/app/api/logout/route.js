import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export const runtime = "nodejs";  // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

export async function POST(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  session.destroy();
  return NextResponse.json({ ok: true }, { headers: res.headers });
}
