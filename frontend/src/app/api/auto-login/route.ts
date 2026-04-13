import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase";
import { cookies } from "next/headers";

const AUTO_LOGIN_TOKEN = process.env.AUTO_LOGIN_TOKEN;
const LATIDO_USER_ID = "070731f7-9641-4d14-a5eb-23980f99ab4d";

/**
 * Auto-login route for Telegram links.
 *
 * GET /api/auto-login?token=SECRET&next=/hoy
 *
 * Validates the secret token, generates a magic link server-side via admin API,
 * exchanges it for a session cookie, and redirects to the target page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") ?? "/hoy";
  const origin = url.origin;

  if (!AUTO_LOGIN_TOKEN || token !== AUTO_LOGIN_TOKEN) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Look up the user's email via admin API
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(LATIDO_USER_ID);

  if (userError || !userData.user?.email) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Generate a magic link server-side (no email sent)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Verify the OTP to create a session
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return NextResponse.redirect(`${origin}/login`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
