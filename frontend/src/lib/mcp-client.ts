const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:8080";

export async function callTool(
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message}`);
  }

  // MCP returns content as array of content blocks
  const content = data.result?.content;
  if (content && content.length > 0 && content[0].type === "text") {
    return JSON.parse(content[0].text);
  }

  return data.result;
}
