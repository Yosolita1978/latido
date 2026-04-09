/**
 * Timezone-aware date utilities.
 *
 * IMPORTANT: Never use `new Date().toISOString().split("T")[0]` for "today" —
 * that returns the UTC date, which is wrong after 5 PM PDT (rolls to tomorrow).
 * Always use these helpers with the user's timezone from settings.
 */

/** Returns "YYYY-MM-DD" for today in the given IANA timezone. */
export function getTodayDate(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Returns "YYYY-MM-DD" for tomorrow in the given IANA timezone. */
export function getTomorrowDate(timezone: string): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const tomorrow = new Date(todayStr + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}
