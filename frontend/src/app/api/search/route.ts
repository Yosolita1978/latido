import { embed } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireUser();
  const { query } = await request.json();

  if (!query || query.trim().length < 3) {
    return Response.json([]);
  }

  const queryEmbedding = await embed(query);

  const results = (await callTool("search_tasks_hybrid", {
    user_id: user.id,
    query_text: query,
    query_embedding: queryEmbedding,
  })) as Array<{ id: string; title: string; status: string; category: string; combined_score: number }>;

  // Only return matches above threshold
  const matches = (results ?? []).filter((r) => r.combined_score > 0.75);

  return Response.json(matches);
}
