import { after } from "next/server";
import { chat, embed, parseJSON } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";
import { getTodayDate } from "@/lib/dates";
import { regeneratePlan } from "@/lib/agents/plan";

interface CaptureResult {
  type: "task" | "activity" | "energy";
  action: "create_new" | "reference_existing";
  match_id: string | null;
  title: string;
  category: string;
  energy_level: string;
  estimated_minutes: number;
  project_id: string | null;
  time_hint: string | null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const { raw_text, capture_mode, scheduled_at } = await request.json();

  if (!raw_text) {
    return Response.json(
      { error: "raw_text is required" },
      { status: 400 },
    );
  }

  const user_id = user.id;

  // Step 1: Generate embedding
  const queryEmbedding = await embed(raw_text);

  // Step 2: Search for similar tasks + get projects (parallel)
  const [rawSearchResults, rawProjects] = await Promise.all([
    callTool("search_tasks_hybrid", {
      user_id,
      query_text: raw_text,
      query_embedding: queryEmbedding,
    }),
    callTool("get_projects", { user_id }),
  ]);

  const searchResults: Array<{ id: string; title: string; combined_score: number }> =
    Array.isArray(rawSearchResults) ? rawSearchResults : [];
  const projects: Array<{ id: string; name: string }> =
    Array.isArray(rawProjects) ? rawProjects : [];

  const projectsList = projects
    .map((p) => `- ${p.name} (id: ${p.id})`)
    .join("\n");

  let matchContext = "";
  const topMatch = searchResults[0];
  if (topMatch && topMatch.combined_score > 0.75) {
    matchContext = `Existing similar tasks found:\n${searchResults
      .map((t) => `- "${t.title}" (id: ${t.id}, score: ${t.combined_score.toFixed(2)})`)
      .join("\n")}\nIf the user is referring to one of these, respond with action "reference_existing" and include the match_id.`;
  }

  const modeHint = capture_mode
    ? `The user selected capture mode: "${capture_mode}". Respect this choice when determining the type.`
    : "";

  // Step 3: Call OpenAI
  const systemPrompt = `You are the Capture Agent for Latido, a daily planner for solopreneurs.

The user submitted this raw input:
"${raw_text}"

${modeHint}

The user's active projects are:
${projectsList}

${matchContext}

Determine what the user is capturing and return ONLY valid JSON:
{
  "type": "task" | "activity" | "energy",
  "action": "create_new" | "reference_existing",
  "match_id": "uuid or null",
  "title": "clear title in the user's language",
  "category": "admin | client_work | deep_work | learning | personal | maintenance",
  "energy_level": "low | medium | high",
  "estimated_minutes": number,
  "project_id": "uuid of matching project or null",
  "time_hint": "HH:MM or null (if the user mentions a specific time)"
}

Type rules:
- "task": actionable work item (send email, fix bug, write document, prepare presentation)
- "activity": recurring personal/life activity (gym, therapy, pilates, doctor, lunch with someone, yoga, walk). These are NOT work tasks — they are life commitments that take time in the day.
- "energy": the user is reporting how they feel (tired, energized, low energy, etc.). Set title to a short description and energy_level to match.

General rules:
- Keep the title in the same language the user used
- If the input mentions a project name, match it to the project list
- Activities typically have category "personal" and time_hint if the user mentioned a time
- Energy reports: set estimated_minutes to 0, category to "personal"
- Estimate minutes realistically. Admin: 15-30min. Deep work: 60-120min. Activities: 30-90min.`;

  const response = await chat(systemPrompt, raw_text, {
    name: "capture-agent",
  });

  const result = parseJSON<CaptureResult>(response);

  // Step 4: Route based on type
  // Fetch user settings for timezone-aware date
  const settings = (await callTool("get_user_settings", { user_id })) as { timezone: string } | null;
  const today = getTodayDate(settings?.timezone ?? "America/Los_Angeles");

  if (result.type === "energy") {
    // Store energy level on today's plan
    const { createAdminClient } = await import("@/lib/supabase");
    const db = createAdminClient();
    await db
      .from("daily_plans")
      .upsert(
        { user_id, plan_date: today, mood: result.energy_level, time_blocks: [], total_planned_minutes: 0 },
        { onConflict: "user_id,plan_date" },
      );

    return Response.json({
      success: true,
      type: "energy",
      action: "energy_logged",
      title: result.title,
      energy_level: result.energy_level,
    });
  }

  if (result.action === "reference_existing" && result.match_id) {
    return Response.json({
      success: true,
      type: result.type,
      task_id: result.match_id,
      action: "reference_existing",
      title: topMatch?.title ?? result.title,
    });
  }

  // Create new task or activity
  const taskResult = (await callTool("capture_task", {
    user_id,
    title: result.title,
    category: result.category,
    energy_level: result.energy_level,
    estimated_minutes: result.estimated_minutes,
    project_id: result.project_id,
    embedding: queryEmbedding,
    ...(scheduled_at && { scheduled_at }),
  })) as { success: boolean; task_id: string };

  // Auto-regenerate today's plan in the background so new task is included
  after(async () => {
    try {
      await regeneratePlan(user_id, today);
    } catch (err) {
      console.error("Auto-regenerate plan failed:", err);
    }
  });

  return Response.json({
    success: true,
    type: result.type,
    task_id: taskResult.task_id,
    action: "create_new",
    title: result.title,
    time_hint: result.time_hint,
  });
}
