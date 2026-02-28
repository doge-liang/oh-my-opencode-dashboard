/**
 * MCP Server - Main server instance creation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServerOptions } from "./types.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({
    name: "oh-my-opencode-dashboard",
    version: "0.5.0",
  });

  // Register all Resources and Tools
  registerResources(server, options);
  registerTools(server, options);

  return server;
}
