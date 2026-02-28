#!/usr/bin/env bun
/**
 * MCP Server CLI Entry Point
 * 
 * Usage:
 *   bun run mcp -- --project /path/to/project
 *   bun run src/server/mcp/index.ts -- --project /path/to/project
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { selectStorageBackend, getLegacyStorageRootForBackend } from "../../ingest/storage-backend.js";

// Parse command line arguments
const args = Bun.argv;
const projectIndex = args.indexOf("--project");

let projectRoot: string;
if (projectIndex !== -1 && args[projectIndex + 1]) {
  projectRoot = args[projectIndex + 1];
} else {
  projectRoot = process.cwd();
}

const storageBackend = selectStorageBackend();
const storageRoot = getLegacyStorageRootForBackend(storageBackend);

// Create MCP Server
const server = createMcpServer({
  projectRoot,
  storageRoot,
  storageBackend,
});

// Create stdio transport
const transport = new StdioServerTransport();

// Connect and run
// Note: All logging must go to stderr to avoid polluting stdio protocol
console.error(`[MCP] Starting server for project: ${projectRoot}`);
console.error(`[MCP] Storage root: ${storageRoot}`);
console.error(`[MCP] Storage backend: ${storageBackend.kind}`);

await server.connect(transport);

console.error("[MCP] Server connected and ready");
