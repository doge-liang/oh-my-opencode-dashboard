#!/usr/bin/env bun
/**
 * MCP Server Bin Entry Point
 * 
 * Usage:
 *   oh-my-opencode-dashboard                          # Start MCP only (no HTTP)
 *   oh-my-opencode-dashboard --project /path          # Start MCP with specified directory
 *   oh-my-opencode-dashboard cli:sessions             # List active sessions
 *   oh-my-opencode-dashboard --http-only --project /path  # Start HTTP server only (no MCP)
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

// Check for --http-only flag
const httpOnly = args.includes("--http-only");
const filteredArgs = args.filter(arg => arg !== "--http-only");

// Check for subcommands
if (filteredArgs[0] === "cli:sessions") {
  // Run sessions CLI directly (no spawn to avoid recursion)
  import("../../cli/sessions.js").catch(console.error);
} else if (httpOnly) {
  // HTTP server only mode - run start.ts directly
  import("../start.js").catch(console.error);
} else {
  // MCP ONLY - do NOT start HTTP server to avoid bunx recursion
  main().catch(console.error);
}

async function main() {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createMcpServer } = await import("./server.js");
  const { selectStorageBackend, getLegacyStorageRootForBackend } = await import("../../ingest/storage-backend.js");

  // Parse --project argument
  const projectIndex = filteredArgs.indexOf("--project");
  let projectRoot: string;
  if (projectIndex !== -1 && filteredArgs[projectIndex + 1]) {
    projectRoot = filteredArgs[projectIndex + 1];
  } else {
    projectRoot = process.cwd();
  }

  const storageBackend = selectStorageBackend();
  const storageRoot = getLegacyStorageRootForBackend(storageBackend);

  // Create MCP Server (NO HTTP SERVER - use --http-only for HTTP)
  const mcpServer = createMcpServer({
    projectRoot,
    storageRoot,
    storageBackend,
  });

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect and run
  console.error(`[MCP] Starting MCP server for project: ${projectRoot}`);
  console.error(`[MCP] Storage root: ${storageRoot}`);
  console.error(`[MCP] Storage backend: ${storageBackend.kind}`);
  console.error(`[MCP] NOTE: HTTP server not started. Use --http-only for HTTP mode.`);

  await mcpServer.connect(transport);

  console.error("[MCP] Server connected and ready");
}

