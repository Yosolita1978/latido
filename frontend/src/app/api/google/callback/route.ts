import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { exchangeCodeAndStore } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const origin = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google=missing_code`);
  }

  // Verify the state matches the authenticated user (CSRF protection)
  if (state !== user.id) {
    return NextResponse.redirect(`${origin}/settings?google=state_mismatch`);
  }

  try {
    await exchangeCodeAndStore(code, user.id);
    return NextResponse.redirect(`${origin}/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?google=exchange_failed`);
  }
}
