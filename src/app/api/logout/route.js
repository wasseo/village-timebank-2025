import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export async function POST(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  session.destroy();
  return NextResponse.json({ ok: true }, { headers: res.headers });
}
