import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";
import { getTodayDate, getTomorrowDate } from "@/lib/dates";

interface UserSettings {
  timezone: string;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const { task_id, status, actual_minutes, completed_at } = await request.json();

  if (!task_id || !status) {
    return Response.json(
      { error: "task_id and status are required" },
      { status: 400 },
    );
  }

  // Update task status
  const result = await callTool("update_task_status", {
    task_id,
    status,
    ...(actual_minutes !== undefined && { actual_minutes }),
    ...(completed_at && { completed_at }),
  });

  // If deferring, also handle the defer-to-tomorrow logic
  if (status === "deferred") {
    const settings = (await callTool("get_user_settings", { user_id: user.id })) as UserSettings | null;
    const timezone = settings?.timezone ?? "America/Los_Angeles";
    const todayDate = getTodayDate(timezone);
    const tomorrowDate = getTomorrowDate(timezone);

    await callTool("defer_to_tomorrow", {
      user_id: user.id,
      task_id,
      plan_date: tomorrowDate,
      today_date: todayDate,
    });
  }

  return Response.json(result);
}
