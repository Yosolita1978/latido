import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface CalendarEvent {
  id: string;
  summary: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  start_iso: string;
  end_iso: string;
  is_all_day: boolean;
}

/**
 * Creates a fresh OAuth2 client (no credentials set).
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

/**
 * Generates the authorization URL the user is redirected to.
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    include_granted_scopes: true,
    prompt: "consent", // forces refresh_token to be returned every time
    state,
  });
}

/**
 * Exchanges an authorization code for tokens and stores them.
 */
export async function exchangeCodeAndStore(code: string, userId: string): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Missing required tokens from Google");
  }

  // Get the user's email for display purposes
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email ?? null;

  const db = createAdminClient();
  await db.from("google_oauth_tokens").upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope ?? SCOPES.join(" "),
      email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/**
 * Returns an authorized OAuth2 client for the given user, refreshing the access token if needed.
 * Returns null if the user has not connected Google Calendar yet.
 */
export async function getAuthorizedClient(userId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("google_oauth_tokens")
    .select("access_token, refresh_token, expiry_date, scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
    scope: data.scope,
  });

  // Listen for token refresh and persist new tokens
  oauth2Client.on("tokens", async (tokens) => {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (tokens.access_token) update.access_token = tokens.access_token;
    if (tokens.expiry_date) update.expiry_date = tokens.expiry_date;
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    await db.from("google_oauth_tokens").update(update).eq("user_id", userId);
  });

  return oauth2Client;
}

/**
 * Disconnects Google Calendar — revokes the tokens and deletes the row.
 */
export async function disconnect(userId: string): Promise<void> {
  const client = await getAuthorizedClient(userId);
  if (client) {
    try {
      await client.revokeCredentials();
    } catch {
      // Ignore — the row will be deleted regardless
    }
  }
  const db = createAdminClient();
  await db.from("google_oauth_tokens").delete().eq("user_id", userId);
}

/**
 * Returns whether the user has connected Google Calendar.
 */
export async function isConnected(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const db = createAdminClient();
  const { data } = await db
    .from("google_oauth_tokens")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  return { connected: !!data, email: data?.email ?? null };
}

/**
 * Fetches today's calendar events for the given user, in the given timezone.
 */
export async function getTodayEvents(userId: string, timezone: string): Promise<CalendarEvent[]> {
  const client = await getAuthorizedClient(userId);
  if (!client) return [];

  // Today's calendar date in the user's timezone (YYYY-MM-DD)
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = dateFmt.format(new Date());

  // Use a wide UTC window (yesterday→day after tomorrow) and filter by user's tz date
  const now = new Date();
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const calendar = google.calendar({ version: "v3", auth: client });
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: timezone,
  });

  const items = response.data.items ?? [];
  const tf = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return items
    .filter((event) => event.status !== "cancelled")
    .filter((event) => {
      const startISO = event.start?.dateTime ?? event.start?.date;
      if (!startISO) return false;
      // For all-day events, event.start.date is "YYYY-MM-DD" in calendar TZ
      if (event.start?.date) {
        return event.start.date === todayStr;
      }
      // For timed events, format the start in the user's tz and compare
      const eventDateInTz = dateFmt.format(new Date(startISO));
      return eventDateInTz === todayStr;
    })
    .map((event): CalendarEvent => {
      const startISO = event.start?.dateTime ?? event.start?.date ?? "";
      const endISO = event.end?.dateTime ?? event.end?.date ?? "";
      const isAllDay = !event.start?.dateTime;

      let startTime = "00:00";
      let endTime = "23:59";
      if (!isAllDay && event.start?.dateTime && event.end?.dateTime) {
        startTime = tf.format(new Date(event.start.dateTime));
        endTime = tf.format(new Date(event.end.dateTime));
      }

      return {
        id: event.id ?? "",
        summary: event.summary ?? "(sin título)",
        start_time: startTime,
        end_time: endTime,
        start_iso: startISO,
        end_iso: endISO,
        is_all_day: isAllDay,
      };
    });
}
