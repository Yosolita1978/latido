import { chat, embed, parseJSON } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";

interface CaptureResult {
  action: "create_new" | "reference_existing";
  match_id: string | null;
  title: string;
  category: string;
  energy_level: string;
  estimated_minutes: number;
  project_id: string | null;
}

export async function POST(request: Request) {
  const { user_id, raw_text } = await request.json();

  if (!user_id || !raw_text) {
    return Response.json(
      { error: "user_id and raw_text are required" },
      { status: 400 },
    );
  }

  // Step 1: Generate embedding of raw_text
  const queryEmbedding = await embed(raw_text);

  // Step 2 & 3: Search for similar tasks + get projects (parallel)
  const [searchResults, projects] = await Promise.all([
    callTool("search_tasks_hybrid", {
      user_id,
      query_text: raw_text,
      query_embedding: queryEmbedding,
    }) as Promise<Array<{ id: string; title: string; combined_score: number }>>,
    callTool("get_projects", { user_id }) as Promise<
      Array<{ id: string; name: string }>
    >,
  ]);

  // Step 4: Build prompt context
  const projectsList = projects
    .map((p) => `- ${p.name} (id: ${p.id})`)
    .join("\n");

  let matchContext = "";
  const topMatch = searchResults?.[0];
  if (topMatch && topMatch.combined_score > 0.75) {
    matchContext = `Existing similar tasks found:\n${searchResults
      .map((t) => `- "${t.title}" (id: ${t.id}, score: ${t.combined_score.toFixed(2)})`)
      .join("\n")}\nIf the user is referring to one of these, respond with match_id instead of creating a new task.`;
  }

  // Step 5: Call OpenAI
  const systemPrompt = `You are the Capture Agent for Latido, a daily planner for solopreneurs.

The user submitted this raw input:
"${raw_text}"

The user's active projects are:
${projectsList}

${matchContext}

Extract a structured task from this input. Return ONLY valid JSON:
{
  "action": "create_new" | "reference_existing",
  "match_id": "uuid or null",
  "title": "clear, actionable task title in the user's language",
  "category": "admin | client_work | deep_work | learning | personal | maintenance",
  "energy_level": "low | medium | high",
  "estimated_minutes": number (your best estimate),
  "project_id": "uuid of matching project or null"
}

Rules:
- Keep the title in the same language the user used
- If the input mentions a project name, match it to the project list
- Estimate minutes realistically. Most admin tasks: 15-30min. Deep work: 60-120min. Client calls: 30-60min.
- "low" energy = mindless/routine. "high" energy = requires deep focus. "medium" = everything else.`;

  const response = await chat(systemPrompt, raw_text, {
    name: "capture-agent",
  });

  const result = parseJSON<CaptureResult>(response);

  // Step 6: Create task or return match
  if (result.action === "create_new") {
    const taskResult = (await callTool("capture_task", {
      user_id,
      title: result.title,
      category: result.category,
      energy_level: result.energy_level,
      estimated_minutes: result.estimated_minutes,
      project_id: result.project_id,
      embedding: queryEmbedding,
    })) as { success: boolean; task_id: string };

    return Response.json({
      success: true,
      task_id: taskResult.task_id,
      action: "create_new",
      title: result.title,
    });
  }

  // reference_existing
  return Response.json({
    success: true,
    task_id: result.match_id,
    action: "reference_existing",
    title: topMatch?.title ?? result.title,
  });
}
