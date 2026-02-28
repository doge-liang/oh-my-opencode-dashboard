/**
 * MCP Resources - Data endpoints that agents can query
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServerOptions } from "./types.js";
import { listSources } from "../../ingest/sources-registry.js";
import { createDashboardStore } from "../dashboard.js";
import { selectStorageBackend } from "../../ingest/storage-backend.js";
import { deriveToolCalls } from "../../ingest/tool-calls.js";

export function registerResources(server: McpServer, options: McpServerOptions) {
  const { projectRoot, storageRoot } = options;
  const storageBackend = selectStorageBackend();

  // Create dashboard store for data retrieval
  const store = createDashboardStore({
    projectRoot,
    storageRoot,
    storageBackend,
    watch: false, // MCP doesn't need watching
    pollIntervalMs: 0,
  });

  // Resource: opencode://sources - List all project sources
  server.registerResource(
    "sources",
    "opencode://sources",
    {
      title: "OpenCode Project Sources",
      description: "List of all monitored project sources",
      mimeType: "application/json",
    },
    async (uri) => {
      const sources = listSources(storageRoot);
      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(sources, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // Resource: opencode://dashboard - Full dashboard snapshot
  server.registerResource(
    "dashboard",
    "opencode://dashboard",
    {
      title: "Dashboard Snapshot",
      description: "Complete dashboard data including plan progress, todos, sessions, and token usage",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = store.getSnapshot();
      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(snapshot, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // Resource: opencode://dashboard/plan - Plan progress only
  server.registerResource(
    "dashboard-plan",
    "opencode://dashboard/plan",
    {
      title: "Plan Progress",
      description: "Current plan progress with completed/total steps",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = store.getSnapshot();
      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(snapshot.planProgress, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // Resource: opencode://dashboard/todos - Todos list
  server.registerResource(
    "dashboard-todos",
    "opencode://dashboard/todos",
    {
      title: "Todos List",
      description: "List of all todos with their status",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = store.getSnapshot() as {
        todos?: unknown[];
        todoSummary?: unknown;
        planProgress?: unknown;
        mainSession?: unknown;
        tokenUsage?: unknown;
        timeSeries?: unknown;
      };
      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify({
              todos: snapshot.todos,
              summary: snapshot.todoSummary,
            }, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // Resource: opencode://dashboard/session - Main session info
  server.registerResource(
    "dashboard-session",
    "opencode://dashboard/session",
    {
      title: "Main Session Info",
      description: "Information about the main active session",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = store.getSnapshot();
      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(snapshot.mainSession, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );
}
