import { chat, embed, parseJSON } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";
import { getTodayEvents } from "@/lib/google-calendar";

interface TimeBlock {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  plan_rank: number;
}

interface PlanResult {
  time_blocks: TimeBlock[];
  total_planned_minutes: number;
  reasoning: string;
}

interface UserSettings {
  timezone: string;
  work_hours_start: string;
  work_hours_end: string;
  max_daily_tasks: number | null;
  planning_time: string;
}

interface Commitment {
  id: string;
  name: string;
  hours_per_week: number;
  category: string;
  project_id: string | null;
  ends_at: string | null;
}

interface Task {
  id: string;
  title: string;
  category: string;
  energy_level: string;
  estimated_minutes: number | null;
  project_id: string | null;
  due_date: string | null;
  deferred_count: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  priority: number;
  hours_per_week_needed: number | null;
  blocked_by: string | null;
}

interface Pattern {
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
}

export interface GeneratePlanResult {
  success: true;
  plan_id: string;
  reasoning: string;
  total_planned_minutes: number;
  tasks_scheduled: number;
}

function getDayOfWeek(dateStr: string): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return days[new Date(dateStr + "T12:00:00").getDay()];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Generates a daily plan for a given user and date.
 * Used by both the user-facing /api/agents/plan endpoint and the n8n CRON /api/cron/plan endpoint.
 */
export async function generatePlan(
  user_id: string,
  plan_date: string,
): Promise<GeneratePlanResult> {
  // Step 1-4: Fetch all context in parallel
  const [settings, commitmentsData, rawTasks, rawProjects] = await Promise.all([
    callTool("get_user_settings", { user_id }) as Promise<UserSettings>,
    callTool("get_active_commitments", { user_id }) as Promise<{
      commitments: Commitment[];
      total_committed_hours_per_week: number;
    }>,
    callTool("get_unscheduled_tasks", { user_id }),
    callTool("get_projects", { user_id }),
  ]);

  const tasks: Task[] = Array.isArray(rawTasks) ? rawTasks : [];
  const projects: Project[] = Array.isArray(rawProjects) ? rawProjects : [];

  // Fetch calendar events (if Google is connected); silently fail if not
  let calendarEvents: Awaited<ReturnType<typeof getTodayEvents>> = [];
  try {
    calendarEvents = await getTodayEvents(user_id, settings.timezone, plan_date);
  } catch {
    // Calendar fetch failed — proceed without events
  }

  // Step 5: Generate context embedding and fetch relevant patterns
  const dayOfWeek = getDayOfWeek(plan_date);
  const commitmentNames = commitmentsData.commitments.map((c) => c.name).join(", ");
  const contextString = `${dayOfWeek} ${plan_date}, ${tasks.length} tasks pending, commitments: ${commitmentNames}`;

  const contextEmbedding = await embed(contextString);

  const patterns = (await callTool("get_user_patterns", {
    user_id,
    context_embedding: contextEmbedding,
  })) as Pattern[];

  // Step 6: Calculate available minutes
  const workStart = timeToMinutes(settings.work_hours_start);
  const workEnd = timeToMinutes(settings.work_hours_end);
  const totalWorkMinutes = workEnd - workStart;
  const committedMinutesPerDay = (commitmentsData.total_committed_hours_per_week / 5) * 60;
  const lunchBreak = 60;

  const calendarMinutesInWorkHours = calendarEvents.reduce((sum, ev) => {
    if (ev.is_all_day) return sum;
    const evStart = timeToMinutes(ev.start_time);
    const evEnd = timeToMinutes(ev.end_time);
    const overlapStart = Math.max(evStart, workStart);
    const overlapEnd = Math.min(evEnd, workEnd);
    return sum + Math.max(0, overlapEnd - overlapStart);
  }, 0);

  const availableMinutes = Math.round(totalWorkMinutes - committedMinutesPerDay - lunchBreak - calendarMinutesInWorkHours);

  // Step 7: Build project lookup for task formatting
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const tasksFormatted = tasks
    .map((t) => {
      const proj = t.project_id ? projectsById.get(t.project_id) : null;
      return `- [${t.id}] "${t.title}" | category: ${t.category} | energy: ${t.energy_level} | est: ${t.estimated_minutes ?? "unknown"}min | deferred: ${t.deferred_count}x${t.due_date ? ` | due: ${t.due_date}` : ""}${proj ? ` | project: ${proj.name}` : ""}`;
    })
    .join("\n");

  const commitmentsFormatted = commitmentsData.commitments
    .map((c) => `- ${c.name}: ${c.hours_per_week}h/week (${c.category})`)
    .join("\n");

  const projectsFormatted = projects
    .map((p) => `- [P${p.priority}] ${p.name} (${p.status}, ${p.hours_per_week_needed ?? "?"}h/week needed)`)
    .join("\n");

  const patternsFormatted = patterns.length > 0
    ? patterns.map((p) => `- ${p.pattern_key}: ${JSON.stringify(p.pattern_value)} (confidence: ${p.confidence})`).join("\n")
    : "No patterns learned yet.";

  const calendarFormatted = calendarEvents.length > 0
    ? calendarEvents
        .map((ev) => ev.is_all_day
          ? `- "${ev.summary}" (todo el día)`
          : `- ${ev.start_time}–${ev.end_time}: "${ev.summary}"`)
        .join("\n")
    : "No calendar events today.";

  // Step 8: Call OpenAI
  const systemPrompt = `You are the Day Architect for Latido, a daily planner for solopreneurs.

IMPORTANT: All user-facing text you produce — especially the "reasoning" field — MUST be written in Spanish (español). Latido is a Spanish-first product. Do NOT respond in English.

Today is: ${dayOfWeek}, ${plan_date}
User's timezone: ${settings.timezone}
Work hours: ${settings.work_hours_start} to ${settings.work_hours_end}
Available planning minutes (after commitments and lunch): ${availableMinutes}
Maximum tasks per day: ${settings.max_daily_tasks ?? "no limit set"}

USER PATTERNS (learned from past behavior):
${patternsFormatted}

CALENDAR EVENTS TODAY (already scheduled — you MUST plan around these, never overlap):
${calendarFormatted}

ACTIVE COMMITMENTS (already consuming time):
${commitmentsFormatted}

ACTIVE PROJECTS (by priority):
${projectsFormatted}

AVAILABLE TASKS:
${tasksFormatted}

Create a daily plan using ONLY the tasks listed above in AVAILABLE TASKS.

CRITICAL: The task_id field MUST be a valid UUID copied exactly from the [uuid] in the AVAILABLE TASKS list.
- Do NOT invent task IDs
- Do NOT use project names, commitment names, or any text as task_id
- Do NOT create tasks that are not in the AVAILABLE TASKS list
- For lunch breaks, use task_id: null and slot_type: "break"
- If there are not enough tasks to fill the day, that is fine — plan fewer blocks

Return ONLY valid JSON:
{
  "time_blocks": [
    {
      "task_id": "copy-exact-uuid-from-available-tasks-or-null-for-breaks",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "slot_type": "deep_work | admin | client_work | learning | personal | maintenance | break",
      "plan_rank": number (1, 2, or 3 for the TOP 3 most important tasks; 0 for all others)
    }
  ],
  "total_planned_minutes": number,
  "reasoning": "Explicación breve de tu lógica de planificación, en español (1-3 frases)"
}

Rules:
- ONLY schedule tasks from the AVAILABLE TASKS list using their exact UUID.
- NEVER schedule a task during a CALENDAR EVENT TODAY time slot. Calendar events are immutable meetings — work around them.
- Respect the available_minutes ceiling. Do NOT overplan.
- If patterns indicate the user completes fewer tasks than planned, plan fewer tasks.
- Schedule high-energy tasks during morning hours (before 12:00).
- Schedule low-energy tasks in the afternoon.
- Include a lunch break around 12:00-13:00 with task_id: null and slot_type: "break".
- Tasks with high deferred_count should be prioritized (the user keeps avoiding them).
- If a task has a due_date approaching, prioritize it.
- Distribute across projects based on priority and hours_per_week_needed.
- Leave 15-30 minutes of buffer time. Do not fill every minute.
- If max_daily_tasks is set, do not exceed it.
- Mark the 3 most important tasks with plan_rank 1, 2, 3. These are the TOP 3 non-negotiable tasks. All other tasks get plan_rank 0.
- TOP 3 criteria: due dates first, then high-priority project tasks, then chronically deferred tasks.`;

  const response = await chat(systemPrompt, `Generate a plan for ${dayOfWeek}, ${plan_date}`, {
    name: "day-architect",
  });

  const result = parseJSON<PlanResult>(response);

  // Step 9: Write the plan via MCP
  const writeResult = (await callTool("write_daily_plan", {
    user_id,
    plan_date,
    time_blocks: result.time_blocks,
    total_planned_minutes: result.total_planned_minutes,
  })) as { success: boolean; plan_id: string };

  return {
    success: true,
    plan_id: writeResult.plan_id,
    reasoning: result.reasoning,
    total_planned_minutes: result.total_planned_minutes,
    tasks_scheduled: result.time_blocks.filter((b) => b.slot_type !== "break").length,
  };
}

interface ExistingPlanBlock {
  task_id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  plan_rank?: number;
  task?: { status: string };
}

interface ExistingPlan {
  id: string;
  time_blocks: ExistingPlanBlock[];
}

/**
 * Regenerates today's plan to include newly captured tasks.
 * Preserves completed task blocks so Enfoque score isn't lost.
 *
 * 1. If no plan exists yet, skip (user hasn't started planning).
 * 2. Save completed blocks aside.
 * 3. Reset "scheduled" tasks to "inbox" for re-planning.
 * 4. Generate a new plan (picks up inbox + new tasks, not completed/deferred).
 * 5. Merge completed blocks back into the new plan.
 */
export async function regeneratePlan(
  user_id: string,
  plan_date: string,
): Promise<GeneratePlanResult | null> {
  const existing = (await callTool("get_todays_plan", {
    user_id,
    plan_date,
  })) as ExistingPlan | null;

  if (!existing || !existing.time_blocks || existing.time_blocks.length === 0) {
    return null;
  }

  // Partition: keep completed blocks, reset scheduled to inbox
  const completedBlocks = existing.time_blocks.filter(
    (b) => b.task_id && b.task?.status === "completed",
  );

  const scheduledTaskIds = existing.time_blocks
    .filter((b) => b.task_id && b.task?.status === "scheduled")
    .map((b) => b.task_id);

  for (const taskId of scheduledTaskIds) {
    await callTool("update_task_status", { task_id: taskId, status: "inbox" });
  }

  // Generate new plan with available tasks (completed tasks excluded automatically).
  // Deferred tasks are included via get_unscheduled_tasks — the AI decides whether
  // to schedule them based on priority and deferred_count.
  const result = await generatePlan(user_id, plan_date);

  // Merge completed blocks back into the new plan
  if (completedBlocks.length > 0) {
    const freshPlan = (await callTool("get_todays_plan", {
      user_id,
      plan_date,
    })) as ExistingPlan | null;

    if (freshPlan?.time_blocks) {
      const completedTaskIds = new Set(completedBlocks.map((b) => b.task_id));
      const newBlocks = freshPlan.time_blocks.filter(
        (b) => !completedTaskIds.has(b.task_id),
      );
      const merged = [...completedBlocks, ...newBlocks].sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      );

      await callTool("write_daily_plan", {
        user_id,
        plan_date,
        time_blocks: merged.map((b) => ({
          task_id: b.task_id,
          start_time: b.start_time,
          end_time: b.end_time,
          slot_type: b.slot_type,
          plan_rank: b.plan_rank ?? 0,
        })),
        total_planned_minutes: result.total_planned_minutes,
      });
    }
  }

  return result;
}
