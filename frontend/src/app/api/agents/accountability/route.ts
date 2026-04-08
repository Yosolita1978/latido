import { requireUser } from "@/lib/auth";
import { runAccountability, NoPlanError } from "@/lib/agents/accountability";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { plan_date } = await request.json();

    if (!plan_date) {
      return Response.json(
        { error: "plan_date is required" },
        { status: 400 },
      );
    }

    const result = await runAccountability(user.id, plan_date);
    return Response.json(result);
  } catch (err) {
    if (err instanceof NoPlanError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("Accountability Agent error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
