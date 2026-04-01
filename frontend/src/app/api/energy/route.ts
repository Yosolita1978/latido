import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { user_id, energy_level } = await request.json();

  if (!user_id || !energy_level) {
    return Response.json(
      { error: "user_id and energy_level are required" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Upsert into daily_plans with mood
  const { error } = await db
    .from("daily_plans")
    .upsert(
      {
        user_id,
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
      .eq("user_id", user_id)
      .eq("plan_date", today);
  }

  return Response.json({ success: true, energy_level });
}
