import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getIronSession<{ user?: { id: string; phone: string } }>(
    cookies() as any,
    sessionOptions as any
  );
  return new Response(JSON.stringify({ user: session.user ?? null }), { status: 200 });
}
