//src/app/api/activities/route.js

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs" ;  // ⚠️ 꼭 필요 (iron-session은 edge 미지원)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req) {
  const res = new NextResponse();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status:401 });

  const { data: list, error: e1 } = await supabase
    .from("activities")
    .select("id, booth_id, amount, category, kind, created_at,booths(name)") // ← booth name 조인
    .eq("user_id", session.user.id)
    .order("created_at", { ascending:false })
    .limit(50);

  if (e1) return NextResponse.json({ ok:false, error:e1.message }, { status:400, headers: res.headers });

  const summary = { total:0, byCategory:{ environment:0, social:0, economic:0, mental:0 }, byKind:{ earn:0, redeem:0 } };
  for (const a of (list || [])) {
    const amt = Number(a.amount||0);
    summary.total += amt;
    if (a.category && summary.byCategory[a.category] !== undefined) summary.byCategory[a.category] += amt;
    if (a.kind && summary.byKind[a.kind] !== undefined) summary.byKind[a.kind] += amt;
  }

  return NextResponse.json({ ok:true, list, summary }, { headers: res.headers });
}
