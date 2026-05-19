import Sandbox from "@e2b/code-interpreter";
import { AgentResult, TextMessage } from "@inngest/agent-kit";

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  return sandbox;
}

export function extractTaskSummary(result: AgentResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;

  // Try result.output first (standard AgentResult structure)
  if (result?.output && Array.isArray(result.output)) {
    return extractFromMessages(result.output);
  }

  // Fallback: try result.history (what @inngest/agent-kit Network.run() actually returns)
  if (r?.history && Array.isArray(r.history)) {
    console.log("[extractTaskSummary] Using result.history, length:", r.history.length);
    return extractFromMessages(r.history);
  }

  // Fallback: try result.state.data.summary directly (set by lifecycle hook)
  if (r?.state?.data?.summary) {
    return r.state.data.summary;
  }

  console.warn("[extractTaskSummary] No output, history, or summary found in result");
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromMessages(messages: any[]): string | undefined {
  if (!messages || messages.length === 0) return undefined;

  const lastAssistantTextMessageIndex = messages.findLastIndex(
    (message) => message?.role === "assistant",
  );

  if (lastAssistantTextMessageIndex === -1) {
    console.warn("[extractTaskSummary] No assistant message found");
    return undefined;
  }

  const message = messages[lastAssistantTextMessageIndex] as TextMessage | undefined;
  if (!message?.content) return undefined;

  let rawContent: string;
  if (typeof message.content === "string") {
    rawContent = message.content;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawContent = (message.content as any[])
      .filter((c) => "text" in c)
      .map((c) => c.text)
      .join("");
  }

  if (!rawContent) return undefined;

  const cleanedContent = rawContent
    .replace(/<task_summary>[\s\S]*?<\/task_summary>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleanedContent || undefined;
}