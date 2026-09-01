import { llm } from '@livekit/agents';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Bridges the Go booking MCP server (booking/cmd/mcp) into LiveKit agent
// tools. Every tool the MCP server publishes is exposed to the LLM
// automatically — add a tool in Go and the receptionist can use it.

const defaultBookingDir = fileURLToPath(new URL('../../booking', import.meta.url));

// Prefer a prebuilt binary (booking/bin/mcp) — `go run` recompiles on every
// call and adds ~3-5s of dead air before the agent can greet. Build it with
//   cd booking && go build -o bin/mcp ./cmd/mcp
const defaultMcpCmd = existsSync(fileURLToPath(new URL('../../booking/bin/mcp', import.meta.url)))
  ? './bin/mcp'
  : 'go run ./cmd/mcp';

export async function connectBookingTools() {
  const [command, ...args] = (process.env.BOOKING_MCP_CMD ?? defaultMcpCmd).split(' ');

  const client = new Client({ name: 'phone-agent', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: command!,
      args,
      cwd: process.env.BOOKING_MCP_CWD ?? defaultBookingDir,
      env: { ...process.env } as Record<string, string>,
    }),
  );

  const { tools } = await client.listTools();
  console.log(`Booking MCP connected — tools: ${tools.map((t) => t.name).join(', ')}`);

  // Per-call idempotency guard: if the LLM re-issues an identical call (e.g. a
  // caller interrupts mid tool-call and Claude retries), replay the first
  // result instead of, say, booking the same table twice. This module is
  // loaded once per agent job, so the cache lifetime == one phone call.
  const recentCalls = new Map<string, string>();

  return tools.map((t) =>
    llm.tool({
      name: t.name,
      description: t.description ?? t.name,
      // MCP input schemas are JSON Schema, which llm.tool accepts directly
      parameters: t.inputSchema as any,
      execute: async (toolArgs: Record<string, unknown>) => {
        const cacheKey = `${t.name}:${JSON.stringify(toolArgs)}`;
        if (recentCalls.has(cacheKey)) {
          console.log(`Booking MCP: replaying cached result for ${cacheKey}`);
          return recentCalls.get(cacheKey)!;
        }

        const result = await client.callTool({ name: t.name, arguments: toolArgs });
        const text = (result.content as Array<{ type: string; text?: string }>)
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('\n');
        const output = result.isError ? `Error: ${text}` : text;

        if (!result.isError) recentCalls.set(cacheKey, output);
        return output;
      },
    }),
  );
}
