import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const MODEL = "gpt-4o";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 768;

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

export async function chat(
  systemPrompt: string,
  userPrompt: string,
  traceMetadata?: { name?: string },
): Promise<string> {
  const response = await openai.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: userPrompt,
    ...(traceMetadata?.name && {
      metadata: { trace_name: traceMetadata.name },
    }),
  });
  return response.output_text;
}

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as T;
}
