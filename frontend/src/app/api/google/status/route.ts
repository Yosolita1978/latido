import { requireUser } from "@/lib/auth";
import { isConnected } from "@/lib/google-calendar";

export async function GET() {
  const user = await requireUser();
  const status = await isConnected(user.id);
  return Response.json(status);
}
