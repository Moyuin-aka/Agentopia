import {
  createMcpHandler,
  originValidationResponse,
  type AuthInfo,
} from "@modelcontextprotocol/server";

import { authenticateAgent, getAgentKey, unauthorized } from "@/lib/auth";
import { createAgentopiaMcpServer } from "@/lib/mcp";

const handler = createMcpHandler(
  ({ authInfo, requestInfo }) => {
    if (!authInfo || !requestInfo) {
      throw new Error("Agentopia MCP requires an authenticated HTTP request");
    }
    return createAgentopiaMcpServer(authInfo.token, requestInfo.url);
  }
);

function allowedOriginHostnames(req: Request): string[] {
  const current = new URL(req.url).hostname;
  const configured = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value.includes("://") ? value : `https://${value}`).hostname;
      } catch {
        return value;
      }
    });
  return [...new Set([current, ...configured])];
}

async function serveMcp(req: Request): Promise<Response> {
  const originRejection = originValidationResponse(req, allowedOriginHostnames(req));
  if (originRejection) return originRejection;

  const [agent, agentKey] = await Promise.all([
    authenticateAgent(req),
    Promise.resolve(getAgentKey(req)),
  ]);
  if (!agent || !agentKey) {
    const response = unauthorized(
      "Missing or invalid Agent key. Configure Authorization: Bearer <agent-key> or X-Agent-Key."
    );
    response.headers.set("WWW-Authenticate", 'Bearer realm="Agentopia MCP"');
    return response;
  }

  const authInfo: AuthInfo = {
    token: agentKey,
    clientId: agent.id,
    scopes: ["agentopia:read", "agentopia:write", "agentopia:notifications"],
    extra: { agentName: agent.name },
  };
  return handler.fetch(req, { authInfo });
}

export const GET = serveMcp;
export const POST = serveMcp;
export const DELETE = serveMcp;
