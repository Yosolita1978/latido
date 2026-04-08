import { chat, embed, parseJSON } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";
import { createAdminClient } from "@/lib/supabase";

interface TaskInBlock {
  id: string;
  title: string;
  status: string;
  actual_minutes: number | null;
  category: string;
  energy_level: string;
}

interface Block {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  task?: TaskInBlock;
}

interface Plan {
  id: string;
  plan_date: string;
  time_blocks: Block[];
  total_planned_minutes: number;
}

interface Pattern {
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
}

interface ExtractedPattern {
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  is_update: boolean;
}

export interface AccountabilityResult {
  success: true;
  completion_rate: number;
  tasks_completed: number;
  tasks_deferred: number;
  reflection: string;
  patterns_written: number;
  tomorrow_priorities: string[];
}

export class NoPlanError extends Error {
  constructor() {
    super("No plan found for this date");
    this.name = "NoPlanError";
  }
}

function getDayOfWeek(dateStr: string): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return days[new Date(dateStr + "T12:00:00").getDay()];
}

/**
 * Runs the Accountability Agent for a given user and date.
 * Used by both the user-facing /api/agents/accountability endpoint and the n8n CRON /api/cron/reflect endpoint.
 */
export async function runAccountability(
  user_id: string,
  plan_date: string,
): Promise<AccountabilityResult> {
  // Step 1: Get today's plan with enriched task data
  const plan = (await callTool("get_todays_plan", {
    user_id,
    plan_date,
  })) as Plan | null;

  if (!plan) {
    throw new NoPlanError();
  }

  // Step 2: Calculate stats
  const taskBlocks = plan.time_blocks.filter(
    (b) => b.slot_type !== "break" && b.task,
  );
  const completedTasks = taskBlocks.filter((b) => b.task!.status === "completed");
  const deferredTasks = taskBlocks.filter((b) => b.task!.status !== "completed");

  const tasksPlanned = taskBlocks.length;
  const tasksCompleted = completedTasks.length;
  const tasksDeferred = deferredTasks.length;
  const completionRate = tasksPlanned > 0
    ? Math.round((tasksCompleted / tasksPlanned) * 100)
    : 0;
  const totalPlannedMinutes = plan.total_planned_minutes;
  const totalCompletedMinutes = completedTasks.reduce(
    (sum, b) => sum + (b.task!.actual_minutes ?? 0),
    0,
  );

  // Step 3: Defer uncompleted tasks (increment deferred_count)
  for (const block of deferredTasks) {
    await callTool("update_task_status", {
      task_id: block.task_id,
      status: "deferred",
    });
  }

  // Step 4: Generate reflection
  const completedList = completedTasks
    .map((b) => `- "${b.task!.title}" (${b.task!.actual_minutes ?? "?"}min)`)
    .join("\n");
  const deferredList = deferredTasks
    .map((b) => `- "${b.task!.title}" (deferred count will increase)`)
    .join("\n");

  const reflectionResponse = await chat(
    `You are the Accountability Agent for Latido.

Today's results for this solopreneur:
- Planned: ${tasksPlanned} tasks (${totalPlannedMinutes} min)
- Completed: ${tasksCompleted} tasks (${totalCompletedMinutes} min)
- Deferred: ${tasksDeferred} tasks
- Completion rate: ${completionRate}%

Tasks completed:
${completedList || "None"}

Tasks deferred:
${deferredList || "None"}

Generate a brief, specific reflection. Max 2 sentences. Be concrete about WHAT happened, not generic motivation. If a pattern is emerging (e.g., same task deferred 3+ times, always overplanning), name it specifically.

Respond in Spanish. Tone: warm, direct, like a trusted friend who's also a good planner. Not a life coach.`,
    `Reflection for ${getDayOfWeek(plan_date)}, ${plan_date}`,
    { name: "accountability-reflection" },
  );

  // Step 5: Update daily_plans with stats and reflection
  const db = createAdminClient();
  await db
    .from("daily_plans")
    .update({
      total_completed_minutes: totalCompletedMinutes,
      completion_rate: completionRate,
      reflection: reflectionResponse.trim(),
    })
    .eq("id", plan.id);

  // Step 6: Pattern extraction
  const rawPatterns = await callTool("get_user_patterns", { user_id });
  const existingPatterns: Pattern[] = Array.isArray(rawPatterns) ? rawPatterns : [];

  const patternsFormatted = existingPatterns.length > 0
    ? existingPatterns
        .map((p) => `- ${p.pattern_key}: ${JSON.stringify(p.pattern_value)} (confidence: ${p.confidence})`)
        .join("\n")
    : "No existing patterns yet.";

  const patternResponse = await chat(
    `You are analyzing a solopreneur's daily work data to extract reusable patterns.

Today's data:
- Day: ${getDayOfWeek(plan_date)}
- Completion rate: ${completionRate}%
- Tasks completed: ${completedList || "None"}
- Tasks deferred: ${deferredList || "None"}
- Time worked: ${totalCompletedMinutes} of ${totalPlannedMinutes} planned

Historical context (existing patterns):
${patternsFormatted}

Extract NEW or UPDATED patterns. Only extract patterns that are actionable for future planning.

Return ONLY valid JSON array:
[
  {
    "pattern_key": "one of: avg_completion_rate | peak_energy_window | chronic_deferrals | overestimation_factor | best_day_for_deep_work | worst_day_for_deep_work | typical_break_duration | meeting_recovery_time | category_preferences | planning_accuracy",
    "pattern_value": { ... relevant structured data ... },
    "is_update": true/false (true if this updates an existing pattern)
  }
]

Rules:
- Only extract patterns you're confident about. Quality over quantity.
- If you see a pattern that contradicts an existing one, mark is_update: true and include the new value.
- Don't extract obvious things ("user has tasks"). Extract behavioral insights ("user defers admin tasks when they have more than 2 deep work tasks in the same day").
- Return empty array [] if no meaningful patterns can be extracted from today's data alone.
- IMPORTANT: All text in pattern_value MUST be in Spanish. The user speaks Spanish.`,
    `Pattern extraction for ${getDayOfWeek(plan_date)}, ${plan_date}`,
    { name: "accountability-patterns" },
  );

  const extractedPatterns = parseJSON<ExtractedPattern[]>(patternResponse);

  // Step 7: Store each extracted pattern
  let patternsWritten = 0;
  for (const pattern of extractedPatterns) {
    const existing = existingPatterns.find((p) => p.pattern_key === pattern.pattern_key);

    let resolvedValue = pattern.pattern_value;
    let confidence = 1;

    if (existing && pattern.is_update) {
      const resolved = await chat(
        `Existing pattern: ${JSON.stringify(existing.pattern_value)}
New observation: ${JSON.stringify(pattern.pattern_value)}
Return the resolved pattern_value as JSON. Keep the most current/accurate information. If the new observation has more data points, prefer it.`,
        "Resolve pattern conflict",
        { name: "accountability-resolve-pattern" },
      );
      resolvedValue = parseJSON<Record<string, unknown>>(resolved);
      confidence = existing.confidence + 1;
    }

    const embeddingText = `${pattern.pattern_key}: ${JSON.stringify(resolvedValue)}`;
    const patternEmbedding = await embed(embeddingText);

    await callTool("write_pattern", {
      user_id,
      pattern_key: pattern.pattern_key,
      pattern_value: resolvedValue,
      embedding: patternEmbedding,
      confidence,
    });

    patternsWritten++;
  }

  // Step 8: Generate next-day priorities
  const tomorrowTasks = await callTool("get_unscheduled_tasks", { user_id }) as Array<{
    id: string;
    title: string;
    category: string;
    energy_level: string;
    deferred_count: number;
    due_date: string | null;
  }>;

  const taskList = Array.isArray(tomorrowTasks) ? tomorrowTasks : [];
  let tomorrowPriorities: string[] = [];

  if (taskList.length > 0) {
    const tasksSummary = taskList
      .slice(0, 10)
      .map((t) => `- "${t.title}" (deferred: ${t.deferred_count}x${t.due_date ? `, due: ${t.due_date}` : ""})`)
      .join("\n");

    const prioritiesResponse = await chat(
      `Based on today's reflection and the available tasks for tomorrow, suggest the TOP 3 priorities.

Today's reflection: ${reflectionResponse.trim()}
Tasks completed today: ${completedList || "None"}
Tasks deferred today: ${deferredList || "None"}

Available tasks for tomorrow:
${tasksSummary}

Return ONLY a JSON array of exactly 3 strings, each being a short task title from the list above. Prioritize:
1. Tasks with approaching due dates
2. Chronically deferred tasks (high deferred_count)
3. Tasks that balance out what was missed today

Example: ["Task title 1", "Task title 2", "Task title 3"]`,
      "Suggest priorities for tomorrow",
      { name: "accountability-priorities" },
    );

    try {
      const parsed = JSON.parse(prioritiesResponse.trim());
      if (Array.isArray(parsed)) {
        tomorrowPriorities = parsed.slice(0, 3);
      }
    } catch {
      // If parsing fails, skip priorities
    }
  }

  return {
    success: true,
    completion_rate: completionRate,
    tasks_completed: tasksCompleted,
    tasks_deferred: tasksDeferred,
    reflection: reflectionResponse.trim(),
    patterns_written: patternsWritten,
    tomorrow_priorities: tomorrowPriorities,
  };
}
