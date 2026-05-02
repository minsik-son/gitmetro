import { NextResponse } from "next/server";
import { readSessionFromRequest, sessionToUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false, user: null });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: sessionToUser(session),
  });
}
