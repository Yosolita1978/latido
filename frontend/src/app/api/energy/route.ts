import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireUser();
  const { energy_level } = await request.json();

  if (!energy_level) {
    return Response.json(
      { error: "energy_level is required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Upsert into daily_plans with mood
  const { error } = await db
    .from("daily_plans")
    .upsert(
      {
        user_id: user.id,
        plan_date: today,
        mood: energy_level,
        time_blocks: [],
        total_planned_minutes: 0,
      },
      { onConflict: "user_id,plan_date" },
    );

  if (error) {
    // If plan already exists, just update mood
    await db
      .from("daily_plans")
      .update({ mood: energy_level })
      .eq("user_id", user.id)
      .eq("plan_date", today);
  }

  return Response.json({ success: true, energy_level });
}
