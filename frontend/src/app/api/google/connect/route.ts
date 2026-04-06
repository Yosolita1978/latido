import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const user = await requireUser();
  // Use the user ID as state so the callback knows who initiated
  const url = getAuthUrl(user.id);
  return NextResponse.redirect(url);
}
