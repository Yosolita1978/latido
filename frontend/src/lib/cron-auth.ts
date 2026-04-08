/**
 * Validates a CRON request by checking the Authorization header against CRON_API_KEY.
 * Returns null if authorized, or a Response (401) if not.
 */
export function validateCronAuth(request: Request): Response | null {
  const expectedKey = process.env.CRON_API_KEY;
  if (!expectedKey) {
    return Response.json(
      { error: "CRON_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${expectedKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
