import { requireUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const user = await requireUser();
  const url = getAuthUrl(user.id);
  return Response.json({
    auth_url: url,
    contains_calendar_scope: url.includes("calendar.events.readonly"),
  });
}
