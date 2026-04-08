import { requireUser } from "@/lib/auth";
import { generatePlan } from "@/lib/agents/plan";

export async function POST(request: Request) {
  const user = await requireUser();
  const { plan_date } = await request.json();

  if (!plan_date) {
    return Response.json(
      { error: "plan_date is required" },
      { status: 400 },
    );
  }

  try {
    const result = await generatePlan(user.id, plan_date);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Plan agent error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
