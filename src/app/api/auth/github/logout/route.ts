import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_RETURN_TO_COOKIE,
  AUTH_STATE_COOKIE,
  getBaseUrl,
} from "@/lib/auth/config";
import { clearCookieOptions } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

function logoutResponse(req: Request): NextResponse {
  const res = NextResponse.redirect(new URL("/", getBaseUrl(req)));
  res.cookies.set(AUTH_COOKIE, "", clearCookieOptions());
  res.cookies.set(AUTH_STATE_COOKIE, "", clearCookieOptions());
  res.cookies.set(AUTH_RETURN_TO_COOKIE, "", clearCookieOptions());
  return res;
}

export async function POST(req: Request) {
  return logoutResponse(req);
}

export async function GET(req: Request) {
  return logoutResponse(req);
}
