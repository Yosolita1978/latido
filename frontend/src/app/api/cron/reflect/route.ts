import { validateCronAuth } from "@/lib/cron-auth";
import { runAccountability, NoPlanError } from "@/lib/agents/accountability";

/**
 * CRON endpoint for n8n to trigger end-of-day reflection.
 *
 * Auth: Authorization: Bearer <CRON_API_KEY>
 * Body: { user_id: string, plan_date: string }
 */
export async function POST(request: Request) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  let body: { user_id?: string; plan_date?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, plan_date } = body;
  if (!user_id || !plan_date) {
    return Response.json(
      { error: "user_id and plan_date are required" },
      { status: 400 },
    );
  }

  try {
    const result = await runAccountability(user_id, plan_date);
    return Response.json(result);
  } catch (err) {
    if (err instanceof NoPlanError) {
      return Response.json(
        {
          success: true,
          skipped: true,
          reason: "no hay plan para esta fecha",
        },
        { status: 200 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("CRON reflect error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
