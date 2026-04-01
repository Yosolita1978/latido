import { callTool } from "@/lib/mcp-client";

export async function POST(request: Request) {
  const { task_id, status, actual_minutes } = await request.json();

  if (!task_id || !status) {
    return Response.json(
      { error: "task_id and status are required" },
      { status: 400 },
    );
  }

  const result = await callTool("update_task_status", {
    task_id,
    status,
    ...(actual_minutes !== undefined && { actual_minutes }),
  });

  return Response.json(result);
}
