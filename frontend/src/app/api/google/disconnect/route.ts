import { requireUser } from "@/lib/auth";
import { disconnect } from "@/lib/google-calendar";

export async function POST() {
  const user = await requireUser();
  await disconnect(user.id);
  return Response.json({ success: true });
}
