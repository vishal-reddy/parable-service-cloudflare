import { Hono } from "hono";
import { McpRequestSchema, SubmitAssessmentSchema } from "../types";
import type { Env } from "../types";

export const mcpRoutes = new Hono<{ Bindings: Env }>();

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "parable-service-cloudflare";
const SERVER_VERSION = "1.0.0";

mcpRoutes.post("/mcp", async (c) => {
  const body = await c.req.json();
  const request = McpRequestSchema.parse(body);

  switch (request.method) {
    case "initialize":
      return c.json({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        },
      });

    case "tools/list":
      return c.json({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: [
            {
              name: "grade_chat_session",
              description:
                "Submit and grade an AI chat session for prompt engineering quality and ethical compliance",
              inputSchema: {
                type: "object",
                properties: {
                  tool: {
                    type: "string",
                    description:
                      "The AI tool used (e.g., claude-code, copilot)",
                  },
                  session_id: {
                    type: "string",
                    description: "Unique session identifier",
                  },
                  project_path: {
                    type: "string",
                    description: "Project directory path",
                  },
                  summary: {
                    type: "string",
                    description: "Session summary",
                  },
                  message_count: {
                    type: "number",
                    description: "Number of messages in session",
                  },
                  prompt_engineering_scores: {
                    type: "object",
                    description: "Prompt engineering evaluation scores",
                  },
                  ethics_scores: {
                    type: "object",
                    description: "Ethical compliance scores",
                  },
                },
                required: ["tool", "session_id"],
              },
            },
          ],
        },
      });

    case "tools/call": {
      const params = request.params as {
        name?: string;
        arguments?: Record<string, unknown>;
      };

      if (params?.name !== "grade_chat_session") {
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: `Unknown tool: ${params?.name}`,
          },
        });
      }

      try {
        const args = params.arguments ?? {};
        const validated = SubmitAssessmentSchema.parse(args);

        // Forward to assessment creation via internal fetch
        const assessmentResponse = await fetch(
          new URL("/api/assessments", c.req.url).toString(),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: c.req.header("Authorization") ?? "",
            },
            body: JSON.stringify(validated),
          }
        );

        const result = await assessmentResponse.json();

        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        });
      } catch (err) {
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32603,
            message:
              err instanceof Error ? err.message : "Internal error",
          },
        });
      }
    }

    default:
      return c.json({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      });
  }
});
