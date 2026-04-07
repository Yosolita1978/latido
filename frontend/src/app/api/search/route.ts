import { embed } from "@/lib/openai";
import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";

interface SearchMatch {
  id: string;
  title: string;
  status: string;
  category: string;
  combined_score: number;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const { query } = await request.json();

  if (!query || query.trim().length < 3) {
    return Response.json([]);
  }

  try {
    const queryEmbedding = await embed(query);

    const raw = await callTool("search_tasks_hybrid", {
      user_id: user.id,
      query_text: query,
      query_embedding: queryEmbedding,
    });

    const results: SearchMatch[] = Array.isArray(raw) ? raw : [];

    // Only return matches above threshold
    const matches = results.filter((r) => r.combined_score > 0.75);

    return Response.json(matches);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Search error:", message);
    return Response.json([]);
  }
}
