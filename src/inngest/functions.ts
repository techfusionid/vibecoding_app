import {
  openai,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { Sandbox } from "e2b";

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

    // Step 1: Buat sandbox SEKALI SAJA di dalam step.run
    const sandboxData = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-2", {
        timeoutMs: 5 * 60 * 1000,
        // @ts-ignore
        ram : 2048,
      });

      // Start Next.js server manual
      sandbox.commands.run(
        "cd /home/user && npx next dev --turbopack --hostname 0.0.0.0 --port 3000 > /tmp/nextjs.log 2>&1",
        { background: true }
      );

      // Tunggu server ready dengan polling
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const check = await sandbox.commands.run(
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000"
          );
          console.log(`[E2B] Port check attempt ${i + 1}: ${check.stdout}`);
          if (check.stdout.trim() === "200") {
            ready = true;
            break;
          }
        } catch {
          console.log(`[E2B] Port check attempt ${i + 1}: not ready yet`);
        }
      }

      if (!ready) {
        // Log untuk debug
        const logs = await sandbox.commands.run("cat /tmp/nextjs.log 2>/dev/null || echo 'no logs'");
        console.error("[E2B] Server not ready. Logs:", logs.stdout);
      }

      const host = sandbox.getHost(3000);
      return {
        sandboxId: sandbox.sandboxId,
        sandboxUrl: `https://${host}`,
      };
    });

    // Step 2: Tunggu Next.js server ready di dalam sandbox
    await step.sleep("wait-for-service", "45s");

    // Step 3: Jalankan agent
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: openai({
        model: "MiniMax-M2.7",
        apiKey: process.env.MINIMAX_API_KEY,
        baseUrl: "https://api.minimax.io/v1",
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use terminal to run commands in the sandbox",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }) => {
            const buffers = { stdout: "", stderr: "" };
            try {
              // Koneksi ke sandbox yang sudah dibuat sebelumnya
              const sandbox = await Sandbox.connect(sandboxData.sandboxId);
              const result = await sandbox.commands.run(command, {
                timeoutMs: 60000,
                onStdout: (data: string) => { buffers.stdout += data; },
                onStderr: (data: string) => { buffers.stderr += data; },
              });
              return result.stdout || result.stderr || "Done";
            } catch (e) {
              console.error(`Command failed: ${e}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`);
              return `Error: ${e}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
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
            try {
              const sandbox = await Sandbox.connect(sandboxData.sandboxId);
              const updatedFiles = context.network?.state.data.files || {};
              for (const file of files) {
                await sandbox.files.write(file.path, file.content);
                updatedFiles[file.path] = file.content;
              }
              if (context.network) {
                context.network.state.data.files = updatedFiles;
              }
              return JSON.stringify(updatedFiles);
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
        if (summary) return;
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

    console.log("[DEBUG] Agent result keys:", Object.keys(result || {}));
    console.log("[DEBUG] Agent result.state.data.summary:", result?.state?.data?.summary);
    console.log("[DEBUG] Agent result.state.data.files keys:", Object.keys(result?.state?.data?.files || {}));

    const summary = result?.state?.data?.summary ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extractTaskSummary(result as any) ||
      "";
    const files = result?.state?.data?.files || {};

    console.log("[DEBUG] Final summary:", summary);
    console.log("[DEBUG] Final files:", Object.keys(files));

    const isError = !summary || Object.keys(files).length === 0;

    console.log("[DEBUG] isError:", isError);

    // Step 4: Simpan ke database
    await step.run("save-result", async () => {
      if (isError) {
        console.error("[save-result] isError=true — summary:", summary, "files:", Object.keys(files));
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      console.log("[save-result] Saving RESULT — summary:", summary.slice(0, 100));
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