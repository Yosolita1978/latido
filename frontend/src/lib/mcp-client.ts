const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:8080";

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

let sessionId: string | null = null;
let initPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "latido-frontend", version: "0.1.0" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP init error: ${response.status}`);
  }

  sessionId = response.headers.get("mcp-session-id");

  // Send initialized notification
  await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: {
      ...HEADERS,
      ...(sessionId && { "mcp-session-id": sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
}

async function ensureInitialized(): Promise<void> {
  if (sessionId) return;
  if (!initPromise) {
    initPromise = initialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

let requestId = 1;

export async function callTool(
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  await ensureInitialized();

  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: "POST",
    headers: {
      ...HEADERS,
      ...(sessionId && { "mcp-session-id": sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId++,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    // Session may have expired — reset and retry once
    if (response.status === 404 || response.status === 406) {
      sessionId = null;
      initPromise = null;
      await ensureInitialized();
      return callTool(toolName, params);
    }
    throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
  }

  // Handle SSE response
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.result) {
          const content = data.result.content;
          if (content && content.length > 0 && content[0].type === "text") {
            try {
              return JSON.parse(content[0].text);
            } catch {
              return content[0].text;
            }
          }
          return data.result;
        }
        if (data.error) {
          throw new Error(`MCP tool error: ${data.error.message}`);
        }
      }
    }
    throw new Error("No result in SSE response");
  }

  // Handle JSON response
  const data = await response.json();

  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message}`);
  }

  const content = data.result?.content;
  if (content && content.length > 0 && content[0].type === "text") {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }

  return data.result;
}
