import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("user_patterns")
    .select("id, pattern_key, pattern_value, confidence, last_updated")
    .eq("user_id", userId)
    .order("confidence", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db.from("user_patterns").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
