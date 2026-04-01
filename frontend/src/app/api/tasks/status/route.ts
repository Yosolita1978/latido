import { callTool } from "@/lib/mcp-client";

export async function POST(request: Request) {
  const { task_id, status, actual_minutes, completed_at, user_id } = await request.json();

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
  if (status === "deferred" && user_id) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    await callTool("defer_to_tomorrow", {
      user_id,
      task_id,
      plan_date: tomorrowDate,
    });
  }

  return Response.json(result);
}
