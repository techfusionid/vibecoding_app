import {
  openai,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";

import { inngest } from "./client";
import { extractTaskSummary } from "./utils";
import z from "zod";
import { PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent", triggers: [{ event: "code-agent/run" }] },
  async ({ event, step }) => {
    console.log("[DEBUG] E2B_API_KEY exists:", !!process.env.E2B_API_KEY);
    console.log("[DEBUG] E2B_API_KEY length:", process.env.E2B_API_KEY?.length);

    const sandboxData = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-2");
      const host = sandbox.getHost(3000);
      return {
        sandboxId: sandbox.sandboxId,
        sandboxUrl: `https://${host}`,
      };
    });

    // e.g. transcript step
    // await step.sleep("wait-a-moment", "5s");

    // Create a new agent with a system prompt (you can add optional tools, too)
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: openai({
        model: "MiniMax-M2.7",
        apiKey: process.env.MINIMAX_API_KEY,
        baseUrl: "https://api.minimax.io/v1",
        defaultParameters: {
          max_tokens: 8192,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }) => {
            const buffers = { stdout: "", stderr: "" };

            try {
              const sandbox = await Sandbox.connect(sandboxData.sandboxId);
              const result = sandbox.commands.run(command, {
                onStdout: (data: string) => {
                  buffers.stdout += data;
                },
                onStderr: (data: string) => {
                  buffers.stderr += data;
                },
              });
              return (await result).stdout;
            } catch (e) {
              console.error(
                `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
              );
              return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`;
            }
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              }),
            ),
          }),
          handler: async (
            { files },
            context: { network?: { state: { data: AgentState } } },
          ) => {
            /**
             * {
             *   /app.tsx: "<p>hi</p>",
             * }
             */

            try {
              const updatedFiles = context.network?.state.data.files || {};
              const sandbox = await Sandbox.connect(sandboxData.sandboxId);
              for (const file of files) {
                await sandbox.files.write(file.path, file.content);
                updatedFiles[file.path] = file.content;
              }
              if (context.network) {
                context.network.state.data.files = updatedFiles;
              }
              return updatedFiles;
            } catch (e) {
              return "Error: " + e;
            }
          },
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }) => {
            try {
              const sandbox = await Sandbox.connect(sandboxData.sandboxId);
              const contents = [];
              for (const file of files) {
                const content = await sandbox.files.read(file);
                contents.push({ path: file, content });
              }
              return JSON.stringify(contents);
            } catch (e) {
              return "Error: " + e;
            }
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const taskSummary = extractTaskSummary(result);

          if (taskSummary && network) {
            network.state.data.summary = taskSummary;
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    let result;
    try {
      result = await network.run(event.data.value);
    } catch (err) {
      console.error("[DEBUG] network.run threw an error:", err);
      result = { output: [], state: { data: { summary: "", files: {} } } };
    }

    // Debug: Log the raw result structure
    console.log("[DEBUG] Agent result keys:", Object.keys(result || {}));
    console.log("[DEBUG] Agent result.state:", result?.state ? "exists" : "undefined");
    console.log("[DEBUG] Agent result.history length:", result?.history?.length);
    console.log("[DEBUG] Agent result.history sample:", JSON.stringify(result?.history?.slice(0, 2)));
    console.log("[DEBUG] Agent result.state.data.summary:", result?.state?.data?.summary);
    console.log("[DEBUG] Agent result.state.data.files keys:", Object.keys(result?.state?.data?.files || {}));

    // Network.run returns the Network object — summary is in state.data.summary (set by lifecycle hook)
    const summary = result?.state?.data?.summary ||
      extractTaskSummary(result as any) ||
      "";
    const files = result?.state?.data?.files || {};

    console.log("[DEBUG] Final summary:", summary);
    console.log("[DEBUG] Final files:", Object.keys(files));

    const isError = !summary || Object.keys(files).length === 0;

    console.log("[DEBUG] isError:", isError, "reason:", !summary ? "no summary" : "no files");

    // Save to db
    await step.run("save-result", async () => {
      if (isError) {
        console.error("[save-result] isError=true — summary:", JSON.stringify(summary), "files:", JSON.stringify(Object.keys(files)));
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      console.log("[save-result] Saving RESULT — summary:", summary.slice(0, 100), "files:", Object.keys(files));
      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: summary,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxData.sandboxUrl,
              title: "Fragment",
              files: files,
            },
          },
        },
      });
    });

    return {
      url: sandboxData.sandboxUrl,
      title: "Fragment",
      files: files,
      summary: summary,
    };
  },
);
