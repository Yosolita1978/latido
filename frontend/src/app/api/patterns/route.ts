import { createAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();

  const db = createAdminClient();
  const { data, error } = await db
    .from("user_patterns")
    .select("id, pattern_key, pattern_value, confidence, last_updated")
    .eq("user_id", user.id)
    .order("confidence", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  const { id } = await request.json();

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("user_patterns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
