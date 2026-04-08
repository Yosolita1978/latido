import { createAdminClient } from "@/lib/supabase";

/**
 * Public health check endpoint for n8n Workflow 5 (Health Monitor).
 *
 * Verifies the Next.js app can reach Supabase by running a trivial count
 * query against `user_settings`. No auth required — health checks must be
 * callable without credentials.
 *
 * Returns 200 + { status: "ok", supabase: "ok", timestamp } on success.
 * Returns 503 + { status: "error", supabase: "error", error, timestamp } on failure.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("user_settings")
      .select("*", { count: "exact", head: true });

    if (error) {
      return Response.json(
        {
          status: "error",
          supabase: "error",
          error: error.message,
          timestamp,
        },
        { status: 503 },
      );
    }

    return Response.json({
      status: "ok",
      supabase: "ok",
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        status: "error",
        supabase: "error",
        error: message,
        timestamp,
      },
      { status: 503 },
    );
  }
}
