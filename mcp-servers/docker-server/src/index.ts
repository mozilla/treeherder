#!/usr/bin/env node

/**
 * Docker MCP Server
 *
 * This MCP server provides tools for managing Docker containers:
 * - docker-compose up/down operations
 * - Building and rebuilding containers
 * - Getting logs from containers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec to use with async/await
const execAsync = promisify(exec);

/**
 * Create an MCP server with Docker management capabilities
 */
const server = new Server(
  {
    name: 'docker-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Handler that lists available Docker tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'docker_compose_up',
        description: 'Start containers using docker-compose up',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                'Path to the directory containing docker-compose.yml',
            },
            detached: {
              type: 'boolean',
              description: 'Run containers in the background',
            },
            build: {
              type: 'boolean',
              description: 'Build images before starting containers',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific services to start (optional)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'docker_compose_down',
        description: 'Stop and remove containers using docker-compose down',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                'Path to the directory containing docker-compose.yml',
            },
            removeVolumes: {
              type: 'boolean',
              description:
                'Remove named volumes declared in the volumes section',
            },
            removeImages: {
              type: 'string',
              description:
                "Remove images, 'local' for only images without a tag, 'all' for all images",
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'docker_compose_build',
        description: 'Build or rebuild containers',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                'Path to the directory containing docker-compose.yml',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific services to build (optional)',
            },
            noCache: {
              type: 'boolean',
              description: 'Do not use cache when building the image',
            },
            pull: {
              type: 'boolean',
              description: 'Always pull newer versions of the image',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'docker_logs',
        description: 'Get logs from a container',
        inputSchema: {
          type: 'object',
          properties: {
            container: {
              type: 'string',
              description: 'Container name or ID',
            },
            tail: {
              type: 'number',
              description: 'Number of lines to show from the end of the logs',
            },
            follow: {
              type: 'boolean',
              description: 'Follow log output',
            },
            since: {
              type: 'string',
              description:
                "Show logs since timestamp (e.g. '2013-01-02T13:23:37Z') or relative (e.g. '42m' for 42 minutes)",
            },
          },
          required: ['container'],
        },
      },
    ],
  };
});

/**
 * Handler for Docker tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'docker_compose_up': {
      const path = String(request.params.arguments?.path);
      const detached = Boolean(request.params.arguments?.detached ?? true);
      const build = Boolean(request.params.arguments?.build ?? false);
      const services = (request.params.arguments?.services as string[]) || [];

      try {
        let command = 'docker-compose up';

        if (detached) {
          command += ' -d';
        }

        if (build) {
          command += ' --build';
        }

        if (services.length > 0) {
          command += ` ${services.join(' ')}`;
        }

        const { stdout, stderr } = await execAsync(command, { cwd: path });

        return {
          content: [
            {
              type: 'text',
              text: stdout || 'Docker Compose up completed successfully.',
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n${error.stderr || ''}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'docker_compose_down': {
      const path = String(request.params.arguments?.path);
      const removeVolumes = Boolean(
        request.params.arguments?.removeVolumes ?? false,
      );
      const removeImages =
        (request.params.arguments?.removeImages as string | null) || null;

      try {
        let command = 'docker-compose down';

        if (removeVolumes) {
          command += ' -v';
        }

        if (removeImages) {
          command += ` --rmi ${removeImages}`;
        }

        const { stdout, stderr } = await execAsync(command, { cwd: path });

        return {
          content: [
            {
              type: 'text',
              text: stdout || 'Docker Compose down completed successfully.',
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n${error.stderr || ''}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'docker_compose_build': {
      const path = String(request.params.arguments?.path);
      const services = (request.params.arguments?.services as string[]) || [];
      const noCache = Boolean(request.params.arguments?.noCache ?? false);
      const pull = Boolean(request.params.arguments?.pull ?? false);

      try {
        let command = 'docker-compose build';

        if (noCache) {
          command += ' --no-cache';
        }

        if (pull) {
          command += ' --pull';
        }

        if (services.length > 0) {
          command += ` ${services.join(' ')}`;
        }

        const { stdout, stderr } = await execAsync(command, { cwd: path });

        return {
          content: [
            {
              type: 'text',
              text: stdout || 'Docker Compose build completed successfully.',
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n${error.stderr || ''}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'docker_logs': {
      const container = String(request.params.arguments?.container);
      const tail = request.params.arguments?.tail as number | undefined;
      const follow = Boolean(request.params.arguments?.follow ?? false);
      const since = request.params.arguments?.since as string | undefined;

      try {
        let command = `docker logs ${container}`;

        if (tail !== undefined) {
          command += ` --tail ${tail}`;
        }

        if (follow) {
          command += ' --follow';
        }

        if (since) {
          command += ` --since ${since}`;
        }

        // For follow mode, we need to set a timeout to avoid hanging indefinitely
        const timeout = follow ? 10000 : undefined;
        const { stdout, stderr } = await execAsync(command, { timeout });

        return {
          content: [
            {
              type: 'text',
              text: stdout || stderr || 'No logs available.',
            },
          ],
        };
      } catch (error: any) {
        // If it's a timeout error from follow mode, return the partial logs
        if (follow && error.killed) {
          return {
            content: [
              {
                type: 'text',
                text:
                  error.stdout ||
                  'Log streaming timed out (showing partial logs).',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n${error.stderr || ''}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new Error('Unknown tool');
  }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Docker MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
