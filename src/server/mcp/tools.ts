/**
 * MCP Tools - Callable functions that agents can invoke
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServerOptions } from "./types.js";
import { listSources, getSourceById } from "../../ingest/sources-registry.js";
import { createDashboardStore } from "../dashboard.js";
import { selectStorageBackend } from "../../ingest/storage-backend.js";

export function registerTools(server: McpServer, options: McpServerOptions) {
  const { projectRoot, storageRoot, storageBackend } = options;

  // Tool: get_dashboard - Get dashboard snapshot
  server.registerTool(
    "get_dashboard",
    {
      title: "Get Dashboard",
      description: "Get the complete dashboard snapshot including plan progress, todos, sessions, and token usage",
      inputSchema: z.object({
        sourceId: z.string().optional().describe("Optional source ID to get dashboard for a specific project"),
      }).optional(),
    },
    async (args: { sourceId?: string } | undefined) => {
      try {
        const sourceId = args?.sourceId;
        
        let targetProjectRoot = projectRoot;
        
        // If sourceId provided, look up the project root
        if (sourceId) {
          const source = getSourceById(storageRoot, sourceId);
          if (!source) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Source with ID "${sourceId}" not found.`,
                },
              ],
              isError: true,
            };
          }
          targetProjectRoot = source.projectRoot;
        }

        const store = createDashboardStore({
          projectRoot: targetProjectRoot,
          storageRoot,
          storageBackend,
          watch: false,
          pollIntervalMs: 0,
        });

        const snapshot = store.getSnapshot();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting dashboard: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: list_sources - List all project sources
  server.registerTool(
    "list_sources",
    {
      title: "List Sources",
      description: "List all monitored project sources",
      inputSchema: z.object({}).optional(),
    },
    async () => {
      try {
        const sources = listSources(storageRoot);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(sources, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing sources: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: refresh_data - Trigger data refresh (re-read from sources)
  server.registerTool(
    "refresh_data",
    {
      title: "Refresh Data",
      description: "Force refresh of dashboard data from all sources",
      inputSchema: z.object({}).optional(),
    },
    async () => {
      try {
        const store = createDashboardStore({
          projectRoot,
          storageRoot,
          storageBackend,
          watch: false,
          pollIntervalMs: 0,
        });

        // Force a refresh by getting the snapshot
        const snapshot = store.getSnapshot();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Data refreshed successfully",
                planProgress: snapshot.planProgress,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error refreshing data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
