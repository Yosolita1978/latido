import { callTool } from "@/lib/mcp-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const settings = await callTool("get_user_settings", { user_id });
    return Response.json(settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { user_id, ...settings } = await request.json();

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const result = await callTool("update_user_settings", {
      user_id,
      settings,
    });
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
